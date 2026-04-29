import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { prisma } from "@/lib/prisma";
import { getEmployeeWellnessOverview } from "@/lib/wellness";
import { canSubmitPayrollAdjustmentRequest } from "@/lib/payrollAdjustmentRequests";

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
      role: true,
      attendantCategory: true,
      isActive: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const canSubmitAdjustments = canSubmitPayrollAdjustmentRequest(user);

  const [overview, payrollAdjustmentRequests, staff] = await Promise.all([
    getEmployeeWellnessOverview(userId),
    (prisma as any).payrollAdjustmentRequest.findMany({
      where: {
        OR: [{ attendantId: userId }, { requestedById: userId }],
      },
      include: {
        attendant: { select: { id: true, name: true, email: true, attendantCategory: true } },
        requestedBy: { select: { id: true, name: true, email: true, attendantCategory: true } },
        decidedBy: { select: { id: true, name: true, email: true, attendantCategory: true } },
        payrollAdjustment: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    }),
    canSubmitAdjustments
      ? prisma.user.findMany({
          where: {
            isActive: true,
            role: { in: ["ATTENDANT", "SUPERVISOR"] },
          },
          select: { id: true, name: true, email: true, attendantCategory: true },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          take: 150,
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json(
    composeIdentityResponse(identity, {
      ...overview,
      user,
      canSubmitPayrollAdjustmentRequest: canSubmitAdjustments,
      payrollAdjustmentRequests,
      staff,
    }),
  );
}
