import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActorId, requireRole } from "@/lib/api";

export async function GET() {
  const auth = await requireRole(["ATTENDANT", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const actorId = await getActorId();
  if (!actorId) return NextResponse.json([], { status: 200 });

  const where =
    auth.role === "ADMIN"
      ? { isActive: true }
      : {
          isActive: true,
          OR: [
            { assignments: { some: { userId: actorId } } },
            { userAssignments: { some: { userId: actorId } } },
          ],
        };

  const shops = await prisma.shop.findMany({
    where,
    select: { id: true, name: true, platform: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(shops);
}
