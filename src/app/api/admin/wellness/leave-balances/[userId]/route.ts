import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { TOTAL_PAID_LEAVE_DAYS, buildLeaveBalanceSummary, ensureLeaveBalance, normalizePaidLeaveEntitlements } from "@/lib/wellness";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ userId: string }> | { userId: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const params = await Promise.resolve(ctx.params);
  const balance = await ensureLeaveBalance(params.userId);
  return NextResponse.json({
    balance: normalizePaidLeaveEntitlements(balance),
    summary: buildLeaveBalanceSummary(balance),
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ userId: string }> | { userId: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await Promise.resolve(ctx.params);
  const body = (await req.json().catch(() => null)) as {
    annualEntitlement?: number;
    sickEntitlement?: number;
    emergencyEntitlement?: number;
    annualUsed?: number;
    sickUsed?: number;
    emergencyUsed?: number;
  } | null;

  const existing = await ensureLeaveBalance(params.userId);
  const patch = {
    annualEntitlement: TOTAL_PAID_LEAVE_DAYS,
    sickEntitlement: 0,
    emergencyEntitlement: 0,
    annualUsed: body?.annualUsed == null ? existing.annualUsed : Math.max(0, Math.trunc(Number(body.annualUsed))),
    sickUsed: body?.sickUsed == null ? existing.sickUsed : Math.max(0, Math.trunc(Number(body.sickUsed))),
    emergencyUsed:
      body?.emergencyUsed == null ? existing.emergencyUsed : Math.max(0, Math.trunc(Number(body.emergencyUsed))),
    updatedById: actorId,
  };

  const updated = await prisma.leaveBalance.update({
    where: { userId: params.userId },
    data: patch,
  });

  await prisma.actionLog.create({
    data: {
      actorId,
      entity: "LeaveBalance",
      entityId: updated.id,
      action: "UPDATE",
      before: existing as unknown as Prisma.InputJsonValue,
      after: updated as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    balance: normalizePaidLeaveEntitlements(updated),
    summary: buildLeaveBalanceSummary(updated),
  });
}
