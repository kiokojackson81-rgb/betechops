import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActorId, requireRole } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireRole(["ATTENDANT", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;
  // allow admin impersonation via query param
  const url = new URL(req.url);
  const impersonateId = url.searchParams.get("impersonateId");
  let actorId = await getActorId();
  if (impersonateId && auth.role === "ADMIN") {
    actorId = impersonateId;
  }
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
