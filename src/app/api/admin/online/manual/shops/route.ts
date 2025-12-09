import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const shops = await prisma.shop.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      assignments: {
        where: { role: Role.ATTENDANT },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const payload = shops.map((shop) => {
    const attendants = shop.assignments
      .map((assignment) => assignment.user)
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .map((user) => ({
        id: user.id,
        name: user.name ?? null,
        email: user.email ?? null,
      }));

    return {
      id: shop.id,
      name: shop.name,
      platform: shop.platform,
      attendants,
    };
  });

  return NextResponse.json(payload);
}
