import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { AttendantCategory, Role } from "@prisma/client";

const categoryValues = new Set(Object.values(AttendantCategory));

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const id = params.id;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    attendantCategory?: string;
    role?: Role;
    isActive?: boolean;
    name?: string;
  };

  const updates: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  if (body.role) updates.role = body.role;
  if (body.name) updates.name = body.name;

  if (body.attendantCategory) {
    if (!categoryValues.has(body.attendantCategory as AttendantCategory)) {
      return NextResponse.json({ error: "invalid_category" }, { status: 400 });
    }
    updates.attendantCategory = body.attendantCategory;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        attendantCategory: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    return NextResponse.json({ error: "update_failed", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
