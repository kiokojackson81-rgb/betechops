import { NextResponse } from "next/server";
import { Prisma, type WellnessRequestStatus } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  buildLeaveBalanceSummary,
  ensureLeaveBalance,
  syncApprovedLeaveBalance,
} from "@/lib/wellness";

export const dynamic = "force-dynamic";
const leaveDecisionValues = ["APPROVED", "REJECTED"] as const;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await Promise.resolve(ctx.params);
  const id = params.id;
  const body = (await req.json().catch(() => null)) as {
    decision?: string;
    status?: string;
    managerComment?: string;
  } | null;

  const decision = String(body?.decision ?? body?.status ?? "").trim().toUpperCase();
  const managerComment = String(body?.managerComment ?? "").trim() || null;
  if (!leaveDecisionValues.includes(decision as (typeof leaveDecisionValues)[number])) {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.leaveRequest.findUnique({ where: { id } });
      if (!existing) throw new Error("Leave request not found");

      if (existing.status === "APPROVED" && decision !== "APPROVED") {
        await syncApprovedLeaveBalance({ leaveRequestId: id, actorId, mode: "revoke", db: tx });
      }

      if (decision === "APPROVED" && existing.status !== "APPROVED") {
        const balance = await ensureLeaveBalance(existing.userId, tx);
        const nextAnnual = balance.annualEntitlement - balance.annualUsed;
        const nextSick = balance.sickEntitlement - balance.sickUsed;
        const nextEmergency = balance.emergencyEntitlement - balance.emergencyUsed;
        if (existing.type === "ANNUAL" && nextAnnual < existing.daysRequested) {
          throw new Error(`Annual leave balance is only ${nextAnnual} day(s)`);
        }
        if (existing.type === "SICK" && nextSick < existing.daysRequested) {
          throw new Error(`Sick leave balance is only ${nextSick} day(s)`);
        }
        if (existing.type === "EMERGENCY" && nextEmergency < existing.daysRequested) {
          throw new Error(`Emergency leave balance is only ${nextEmergency} day(s)`);
        }
      }

      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: decision as WellnessRequestStatus,
          managerComment,
          approvedById: actorId,
          decidedAt: new Date(),
        },
      });

      if (decision === "APPROVED" && existing.status !== "APPROVED") {
        await syncApprovedLeaveBalance({ leaveRequestId: id, actorId, mode: "approve", db: tx });
      }

      const balance = await ensureLeaveBalance(existing.userId, tx);
      await tx.actionLog.create({
        data: {
          actorId,
          entity: "LeaveRequest",
          entityId: id,
          action: decision,
          before: existing as unknown as Prisma.InputJsonValue,
          after: updated as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        updated,
        leaveBalance: buildLeaveBalanceSummary(balance),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update leave request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
