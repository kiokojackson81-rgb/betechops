import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  assertCashAdvanceRepaymentPeriod,
  assertCashAdvanceWithinSalaryCap,
  buildCashAdvanceInstallments,
  normalizeCashAdvanceRepaymentPeriodValue,
} from "@/lib/wellness";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { notifyCashAdvanceDeleted, notifyCashAdvanceUpdated } from "@/lib/wellnessNotifications";

export const dynamic = "force-dynamic";

async function rebuildAdvanceSchedule(input: {
  tx: Prisma.TransactionClient;
  cashAdvanceId: string;
  userId: string;
  actorId: string;
  approvedAmount: number;
  repaymentPeriod: number;
  firstDeductionDate?: string | null;
  allowSalaryCapOverride: boolean;
}) {
  const normalizedRepaymentPeriod = assertCashAdvanceRepaymentPeriod(input.repaymentPeriod);
  const salaryCapacity = await assertCashAdvanceWithinSalaryCap(input.userId, input.approvedAmount, {
    db: input.tx,
    excludeAdvanceId: input.cashAdvanceId,
    allowSalaryCapOverride: input.allowSalaryCapOverride,
  });

  const existingInstallments = await input.tx.cashAdvanceInstallment.findMany({
    where: { cashAdvanceId: input.cashAdvanceId },
    select: { id: true, payrollAdjustmentId: true, isPaid: true },
  });

  if (existingInstallments.some((item) => item.isPaid)) {
    throw new Error("This cash advance already has paid installments and cannot be rescheduled");
  }

  const payrollAdjustmentIds = existingInstallments
    .map((item) => item.payrollAdjustmentId)
    .filter((value): value is string => Boolean(value));
  if (payrollAdjustmentIds.length) {
    await input.tx.attendantPayrollAdjustment.deleteMany({
      where: { id: { in: payrollAdjustmentIds } },
    });
  }
  await input.tx.cashAdvanceInstallment.deleteMany({
    where: { cashAdvanceId: input.cashAdvanceId },
  });

  const firstReferenceDate = input.firstDeductionDate ? new Date(input.firstDeductionDate) : new Date();
  const schedules = buildCashAdvanceInstallments({
    approvedAmount: input.approvedAmount,
    repaymentPeriod: normalizedRepaymentPeriod,
    firstPeriod: getTradingPeriodFor(firstReferenceDate),
    firstDeductionDate: firstReferenceDate,
  });

  const updated = await input.tx.cashAdvance.update({
    where: { id: input.cashAdvanceId },
    data: {
      approvedAmount: input.approvedAmount,
      repaymentPeriod: normalizedRepaymentPeriod,
      installmentAmount: Math.max(...schedules.map((item) => item.amount)),
      remainingBalance: input.approvedAmount,
      approvedById: input.actorId,
      approvedAt: new Date(),
      status: "APPROVED",
    },
  });

  for (const item of schedules) {
    const installment = await input.tx.cashAdvanceInstallment.create({
      data: {
        cashAdvanceId: updated.id,
        dueDate: item.dueDate,
        periodKey: item.periodKey,
        periodLabel: item.periodLabel,
        sequenceNumber: item.sequenceNumber,
        amount: item.amount,
      },
    });
    const scheduledAdjustment = await input.tx.attendantPayrollAdjustment.create({
      data: {
        attendantId: updated.userId,
        periodKey: item.periodKey,
        periodLabel: item.periodLabel,
        adjustmentType: "CASH_ADVANCE",
        label: `Cash advance repayment ${item.sequenceNumber}/${normalizeCashAdvanceRepaymentPeriodValue(updated.repaymentPeriod)}`,
        amount: item.amount,
        createdById: input.actorId,
        adjustmentKind: "DEDUCTION",
      },
    });
    await input.tx.cashAdvanceInstallment.update({
      where: { id: installment.id },
      data: { payrollAdjustmentId: scheduledAdjustment.id },
    });
  }

  return {
    updated,
    salaryCapacity,
    salaryCapOverrideApplied:
      input.allowSalaryCapOverride &&
      (salaryCapacity.salary <= 0 || input.approvedAmount > salaryCapacity.availableToBorrow),
  };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const id = params.id;
  const body = (await req.json().catch(() => null)) as {
    requestedAmount?: number;
    approvedAmount?: number;
    reason?: string;
    repaymentPeriod?: number;
    hrComment?: string | null;
    firstDeductionDate?: string | null;
    userId?: string;
  } | null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.cashAdvance.findUnique({
        where: { id },
        include: { installments: true },
      });
      if (!existing) throw new Error("Cash advance request not found");

      const requestedAmount = Math.trunc(Number(body?.requestedAmount ?? existing.requestedAmount));
      const approvedAmountRaw = body?.approvedAmount ?? existing.approvedAmount ?? requestedAmount;
      const approvedAmount = Math.trunc(Number(approvedAmountRaw));
      const reason = String(body?.reason ?? existing.reason).trim();
      const repaymentPeriod = Math.trunc(Number(body?.repaymentPeriod ?? existing.repaymentPeriod ?? 1));
      const hrComment =
        body?.hrComment === undefined ? existing.hrComment : String(body.hrComment ?? "").trim() || null;
      const userId = String(body?.userId ?? existing.userId).trim() || existing.userId;

      if (requestedAmount <= 0) throw new Error("Requested amount must be greater than zero");
      if (!reason) throw new Error("Reason is required");
      if (repaymentPeriod <= 0) throw new Error("Repayment period must be at least 1 month");

      await tx.cashAdvance.update({
        where: { id },
        data: {
          userId,
          requestedAmount,
          reason,
          hrComment,
          repaymentPeriod: assertCashAdvanceRepaymentPeriod(repaymentPeriod),
          ...(existing.status !== "APPROVED"
            ? {
                approvedAmount: null,
                installmentAmount: null,
                remainingBalance: 0,
              }
            : {}),
        },
      });

      let salaryCapAudit: {
        salaryCapacity: { salary: number; outstandingBalance: number; availableToBorrow: number };
        salaryCapOverrideApplied: boolean;
      } | null = null;
      if (existing.status === "APPROVED") {
        const rebuilt = await rebuildAdvanceSchedule({
          tx,
          cashAdvanceId: id,
          userId,
          actorId,
          approvedAmount: approvedAmount > 0 ? approvedAmount : requestedAmount,
          repaymentPeriod,
          firstDeductionDate: body?.firstDeductionDate ?? null,
          allowSalaryCapOverride: auth.role === "ADMIN",
        });
        salaryCapAudit = {
          salaryCapacity: rebuilt.salaryCapacity,
          salaryCapOverrideApplied: rebuilt.salaryCapOverrideApplied,
        };
      }

      const finalRecord = await tx.cashAdvance.findUnique({
        where: { id },
        include: {
          installments: { orderBy: [{ dueDate: "asc" }] },
          approvedBy: { select: { id: true, name: true, email: true } },
          user: { select: { id: true, name: true, email: true, attendantCategory: true } },
        },
      });

      await tx.actionLog.create({
        data: {
          actorId,
          entity: "CashAdvance",
          entityId: id,
          action: "UPDATE",
          before: existing as unknown as Prisma.InputJsonValue,
          after: {
            ...finalRecord,
            ...salaryCapAudit,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        updated: finalRecord,
        recipient: await tx.user.findUnique({
          where: { id: userId },
          select: { name: true, phone: true },
        }),
      };
    });

    await notifyCashAdvanceUpdated({
      recipient: result.recipient ?? {},
      requestedAmount: Number(result.updated?.requestedAmount ?? 0),
      approvedAmount: Number(result.updated?.approvedAmount ?? 0),
      repaymentPeriod: Number(result.updated?.repaymentPeriod ?? 0),
      hrComment: result.updated?.hrComment ?? null,
    });

    return NextResponse.json({ updated: result.updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update cash advance";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const id = params.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.cashAdvance.findUnique({
        where: { id },
        include: { installments: true },
      });
      if (!existing) throw new Error("Cash advance request not found");
      if (existing.installments.some((item) => item.isPaid)) {
        throw new Error("This cash advance already has paid installments and cannot be deleted");
      }

      const payrollAdjustmentIds = existing.installments
        .map((item) => item.payrollAdjustmentId)
        .filter((value): value is string => Boolean(value));
      if (payrollAdjustmentIds.length) {
        await tx.attendantPayrollAdjustment.deleteMany({
          where: { id: { in: payrollAdjustmentIds } },
        });
      }
      await tx.cashAdvanceInstallment.deleteMany({ where: { cashAdvanceId: id } });
      await tx.cashAdvance.delete({ where: { id } });
      await tx.actionLog.create({
        data: {
          actorId,
          entity: "CashAdvance",
          entityId: id,
          action: "DELETE",
          before: existing as unknown as Prisma.InputJsonValue,
        },
      });
      return {
        deleted: existing,
        recipient: await tx.user.findUnique({
          where: { id: existing.userId },
          select: { name: true, phone: true },
        }),
      };
    });

    await notifyCashAdvanceDeleted({
      recipient: result.recipient ?? {},
      requestedAmount: Number(result.deleted.requestedAmount ?? 0),
      approvedAmount: Number(result.deleted.approvedAmount ?? 0),
      repaymentPeriod: Number(result.deleted.repaymentPeriod ?? 0),
      hrComment: result.deleted.hrComment ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete cash advance";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
