import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { prisma } from "@/lib/prisma";
import { getEmployeeWellnessOverview } from "@/lib/wellness";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const userId = identity.resolvedUserId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      attendantCategory: true,
      isActive: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const overview = await getEmployeeWellnessOverview(userId);

  return NextResponse.json(
    composeIdentityResponse(identity, {
      ...overview,
      user,
    }),
  );
}
