import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { AttendantCategory, Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { categoryValues, sanitizeCategories, syncUserCategories, shapeUser } from "../route";

export async function PATCH(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const pathname = new URL(request.url).pathname;
  const id = pathname.substring(pathname.lastIndexOf("/") + 1);
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    attendantCategory?: string;
    role?: Role;
    isActive?: boolean;
    name?: string;
    categories?: string[];
  };

  const hasPrimitiveUpdate =
    typeof body.isActive === "boolean" || Boolean(body.role) || Boolean(body.name) || Boolean(body.attendantCategory);
  const includesCategoryUpdate = Array.isArray(body.categories);
  if (!hasPrimitiveUpdate && !includesCategoryUpdate) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  const attendantCategoryUpdate = body.attendantCategory
    ? (categoryValues.has(body.attendantCategory.toUpperCase() as AttendantCategory)
        ? (body.attendantCategory.toUpperCase() as AttendantCategory)
        : null)
    : null;

  if (body.attendantCategory && !attendantCategoryUpdate) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          attendantCategory: true,
        },
      });
      if (!existing) {
        throw new Error("not_found");
      }

      const fallbackPrimary = attendantCategoryUpdate ?? existing.attendantCategory;
      const desiredAssignments = includesCategoryUpdate
        ? sanitizeCategories(body.categories ?? [], fallbackPrimary)
        : null;

      const data: Prisma.UserUpdateInput = {};
      if (typeof body.isActive === "boolean") data.isActive = body.isActive;
      if (body.role) data.role = body.role;
      if (body.name) data.name = body.name;
      if (desiredAssignments && desiredAssignments.length) {
        data.attendantCategory = desiredAssignments[0];
      } else if (attendantCategoryUpdate) {
        data.attendantCategory = attendantCategoryUpdate;
      }

      const saved = await tx.user.update({
        where: { id },
        data,
        select: {
          id: true,
        },
      });

      if (desiredAssignments) {
        await syncUserCategories(tx, saved.id, desiredAssignments);
      } else if (attendantCategoryUpdate) {
        await tx.attendantCategoryAssignment.upsert({
          where: { userId_category: { userId: saved.id, category: attendantCategoryUpdate } },
          update: {},
          create: { userId: saved.id, category: attendantCategoryUpdate },
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: saved.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          attendantCategory: true,
          isActive: true,
          updatedAt: true,
          categoryAssignments: { select: { category: true } },
        },
      });
    });

    return NextResponse.json({ ok: true, user: shapeUser(updated) });
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "update_failed", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
