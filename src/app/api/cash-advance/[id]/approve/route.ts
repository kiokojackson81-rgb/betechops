import { NextResponse } from "next/server";
import { Prisma, type CashAdvanceRequestStatus } from "@prisma/client";
import { getActorId, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

const decisionValues = ["APPROVED", "REJECTED"] as const;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await Promise.resolve(ctx.params);
  const id = params.id;
  const body = (await req.json().catch(() => null)) as {
    decision?: string;
    approvedAmount?: number;
    adminComment?: string;
    periodKey?: string;
    periodLabel?: string;
  } | null;

  const decision = String(body?.decision ?? "").trim().toUpperCase();
  const approvedAmount = Math.trunc(Number(body?.approvedAmount ?? 0));
  const adminComment = String(body?.adminComment ?? "").trim() || null;

  if (!decisionValues.includes(decision as (typeof decisionValues)[number])) {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.cashAdvanceRequest.findUnique({
        where: { id },
      });
      if (!existing) throw new Error("Cash advance request not found");
      if (existing.status !== "PENDING") throw new Error("Only pending requests can be updated");

      let payrollAdjustmentId: string | null = null;
      if (decision === "APPROVED") {
        if (approvedAmount <= 0) throw new Error("approvedAmount must be greater than zero");
        if (approvedAmount > existing.requestedAmount) {
          throw new Error("approvedAmount cannot exceed the requested amount");
        }

        const period = getTradingPeriodFor(new Date());
        const createdAdjustment = await tx.attendantPayrollAdjustment.create({
          data: {
            attendantId: existing.userId,
            periodKey: String(body?.periodKey ?? period.key).trim() || period.key,
            periodLabel: String(body?.periodLabel ?? period.label).trim() || period.label,
            adjustmentType: "OTHER",
            adjustmentKind: "DEDUCTION",
            label: "Cash advance",
            amount: approvedAmount,
            createdById: actorId,
          },
          select: { id: true },
        });
        payrollAdjustmentId = createdAdjustment.id;
      }

      const result = await tx.cashAdvanceRequest.update({
        where: { id },
        data: {
          status: decision as CashAdvanceRequestStatus,
          approvedAmount: decision === "APPROVED" ? approvedAmount : null,
          adminComment,
          payrollAdjustmentId,
          approvedById: actorId,
          approvedAt: new Date(),
        },
        include: {
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.actionLog.create({
        data: {
          actorId,
          entity: "CashAdvanceRequest",
          entityId: id,
          action: decision,
          before: existing as unknown as Prisma.InputJsonValue,
          after: result as unknown as Prisma.InputJsonValue,
        },
      });

      return result;
    });

    return NextResponse.json({ updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update cash advance request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
