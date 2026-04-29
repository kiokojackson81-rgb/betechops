import { NextResponse } from "next/server";
import { Prisma, type WellnessRequestStatus } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const decisionValues = ["APPROVED", "REJECTED"] as const;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const id = params.id;
  const body = (await req.json().catch(() => null)) as {
    decision?: string;
    status?: string;
    adminComment?: string;
    amount?: number | string;
  } | null;

  const decision = String(body?.decision ?? body?.status ?? "").trim().toUpperCase();
  const adminComment = String(body?.adminComment ?? "").trim() || null;
  const overrideAmount = body?.amount == null || body.amount === "" ? null : Math.trunc(Number(body.amount));

  if (!decisionValues.includes(decision as (typeof decisionValues)[number])) {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  }
  if (overrideAmount != null && (!Number.isFinite(overrideAmount) || overrideAmount <= 0)) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await (tx as any).payrollAdjustmentRequest.findUnique({
        where: { id },
        include: {
          attendant: { select: { id: true, name: true, email: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
        },
      });
      if (!existing) throw new Error("Adjustment request not found");
      if (existing.status !== "PENDING") throw new Error("Only pending requests can be reviewed");
      if (existing.requestedById === actorId) {
        throw new Error("You cannot approve a payroll adjustment request you submitted");
      }

      let payrollAdjustmentId: string | null = existing.payrollAdjustmentId ?? null;
      const approvedAmount = overrideAmount ?? existing.amount;

      if (decision === "APPROVED") {
        const adjustment = await tx.attendantPayrollAdjustment.create({
          data: {
            attendantId: existing.attendantId,
            periodKey: existing.periodKey,
            periodLabel: existing.periodLabel,
            adjustmentType: existing.adjustmentType,
            label: existing.label,
            amount: approvedAmount,
            createdById: actorId,
            adjustmentKind: existing.adjustmentKind,
          },
        });
        payrollAdjustmentId = adjustment.id;
      }

      const updated = await (tx as any).payrollAdjustmentRequest.update({
        where: { id },
        data: {
          status: decision as WellnessRequestStatus,
          amount: approvedAmount,
          decidedById: actorId,
          decidedAt: new Date(),
          adminComment,
          payrollAdjustmentId,
        },
        include: {
          attendant: { select: { id: true, name: true, email: true, attendantCategory: true } },
          requestedBy: { select: { id: true, name: true, email: true, attendantCategory: true } },
          decidedBy: { select: { id: true, name: true, email: true, attendantCategory: true } },
          payrollAdjustment: true,
        },
      });

      await tx.actionLog.create({
        data: {
          actorId,
          entity: "PayrollAdjustmentRequest",
          entityId: id,
          action: decision,
          before: existing as unknown as Prisma.InputJsonValue,
          after: updated as unknown as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    return NextResponse.json({ updated: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to review adjustment request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
