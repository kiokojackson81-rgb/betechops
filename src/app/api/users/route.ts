import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { AttendantCategory, Role } from "@prisma/client";
import { categoryValues, sanitizeCategories, shapeUser, syncUserCategories } from "./utils";

export async function GET(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const rawRoles = (url.searchParams.get("roles") || "ATTENDANT").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const validRoles = rawRoles
    .map((role): Role | null => (role === "ADMIN" || role === "SUPERVISOR" || role === "ATTENDANT" ? (role as Role) : null))
    .filter((role): role is Role => Boolean(role));
  const roles: Role[] = validRoles.length ? validRoles : ["ATTENDANT"];

  const categoryParam = url.searchParams.get("category")?.toUpperCase() || undefined;
  const categoryFilter = categoryParam && categoryValues.has(categoryParam as AttendantCategory) ? (categoryParam as AttendantCategory) : undefined;
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const users = await prisma.user.findMany({
    where: {
      role: { in: roles },
      ...(includeInactive ? {} : { isActive: true }),
      ...(categoryFilter
        ? {
            OR: [
              { attendantCategory: categoryFilter },
              { categoryAssignments: { some: { category: categoryFilter } } },
            ],
          }
        : {}),
    },
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      attendantCategory: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      categoryAssignments: { select: { category: true } },
    },
  });

  return NextResponse.json(users.map(shapeUser));
}

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    role?: Role;
    category?: string;
    categories?: string[];
  };

  const { email, name, role } = body;
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const normalizedEmail = email.toLowerCase().trim();
  const primaryCandidate = body.category?.toUpperCase();
  const fallbackPrimary = primaryCandidate && categoryValues.has(primaryCandidate as AttendantCategory) ? (primaryCandidate as AttendantCategory) : AttendantCategory.GENERAL;
  const desiredCategories = sanitizeCategories(body.categories ?? (primaryCandidate ? [primaryCandidate] : []), fallbackPrimary);
  const primaryCategory = desiredCategories[0] ?? AttendantCategory.GENERAL;

  const user = await prisma.$transaction(async (tx) => {
    const saved = await tx.user.upsert({
      where: { email: normalizedEmail },
      update: {
        name: name ?? undefined,
        role: role ?? undefined,
        isActive: true,
        attendantCategory: primaryCategory,
      },
      create: {
        email: normalizedEmail,
        name: name ?? normalizedEmail.split("@")[0],
        role: role ?? "ATTENDANT",
        attendantCategory: primaryCategory,
        isActive: true,
      },
    });

    await syncUserCategories(tx, saved.id, desiredCategories);

    return tx.user.findUniqueOrThrow({
      where: { id: saved.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        attendantCategory: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        categoryAssignments: { select: { category: true } },
      },
    });
  });

  return NextResponse.json({ ok: true, user: shapeUser(user) }, { status: 201 });
}
