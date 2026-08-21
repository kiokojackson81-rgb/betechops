import { NextResponse } from "next/server";
import { Prisma, type WellnessRequestStatus } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  assertCashAdvanceRepaymentPeriod,
  assertCashAdvanceWithinSalaryCap,
  buildCashAdvanceInstallments,
  normalizeCashAdvanceRepaymentPeriodValue,
} from "@/lib/wellness";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { notifyCashAdvanceApproved, notifyCashAdvanceRejected } from "@/lib/wellnessNotifications";

export const dynamic = "force-dynamic";
const advanceDecisionValues = ["APPROVED", "REJECTED"] as const;

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
    approvedAmount?: number;
    repaymentPeriod?: number;
    hrComment?: string;
    firstDeductionDate?: string;
  } | null;

  const decision = String(body?.decision ?? body?.status ?? "").trim().toUpperCase();
  const approvedAmount = Math.trunc(Number(body?.approvedAmount ?? 0));
  const repaymentPeriod = Math.trunc(Number(body?.repaymentPeriod ?? 0));
  const hrComment = String(body?.hrComment ?? "").trim() || null;

  if (!advanceDecisionValues.includes(decision as (typeof advanceDecisionValues)[number])) {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.cashAdvance.findUnique({
        where: { id },
        include: { installments: true },
      });
      if (!existing) throw new Error("Cash advance request not found");

      if (existing.status === "APPROVED" && decision === "REJECTED") {
        throw new Error("Approved cash advances cannot be rejected after scheduling deductions");
      }

      let schedules: Array<{
        dueDate: Date;
        periodKey: string;
        periodLabel: string;
        sequenceNumber: number;
        amount: number;
      }> = [];
      let salaryCapacity: {
        salary: number;
        outstandingBalance: number;
        availableToBorrow: number;
      } | null = null;

      if (decision === "APPROVED") {
        if (approvedAmount <= 0 || repaymentPeriod <= 0) {
          throw new Error("approvedAmount and repaymentPeriod must be greater than zero");
        }
        const normalizedRepaymentPeriod = assertCashAdvanceRepaymentPeriod(repaymentPeriod);
        salaryCapacity = await assertCashAdvanceWithinSalaryCap(existing.userId, approvedAmount, {
          db: tx,
          excludeAdvanceId: existing.id,
          allowSalaryCapOverride: auth.role === "ADMIN",
        });
        const firstReferenceDate = body?.firstDeductionDate ? new Date(body.firstDeductionDate) : new Date();
        schedules = buildCashAdvanceInstallments({
          approvedAmount,
          repaymentPeriod: normalizedRepaymentPeriod,
          firstPeriod: getTradingPeriodFor(firstReferenceDate),
          firstDeductionDate: firstReferenceDate,
        });
      }

      if (existing.installments.some((item) => item.isPaid)) {
        throw new Error("This cash advance already has paid installments and cannot be rescheduled");
      }

      await tx.cashAdvanceInstallment.deleteMany({
        where: { cashAdvanceId: id },
      });

      const updated = await tx.cashAdvance.update({
        where: { id },
        data: {
          status: decision as WellnessRequestStatus,
          approvedAmount: decision === "APPROVED" ? approvedAmount : null,
          repaymentPeriod:
            decision === "APPROVED" ? assertCashAdvanceRepaymentPeriod(repaymentPeriod) : existing.repaymentPeriod,
          installmentAmount:
            decision === "APPROVED"
              ? Math.max(...schedules.map((item) => item.amount))
              : null,
          remainingBalance: decision === "APPROVED" ? approvedAmount : 0,
          hrComment,
          approvedById: actorId,
          approvedAt: new Date(),
        },
      });

      const createdInstallments: Array<{
        id: string;
        periodKey: string;
        periodLabel: string;
        sequenceNumber: number;
        amount: number;
      }> = [];
      if (schedules.length > 0) {
        for (const item of schedules) {
          const installment = await tx.cashAdvanceInstallment.create({
            data: {
              cashAdvanceId: updated.id,
              dueDate: item.dueDate,
              periodKey: item.periodKey,
              periodLabel: item.periodLabel,
              sequenceNumber: item.sequenceNumber,
              amount: item.amount,
            },
          });
          createdInstallments.push(installment);
        }
      }

      if (decision === "APPROVED" && createdInstallments.length > 0) {
        const immediateInstallment = createdInstallments[0];
        const immediateAdjustment = await tx.attendantPayrollAdjustment.create({
          data: {
            attendantId: updated.userId,
            periodKey: immediateInstallment.periodKey,
            periodLabel: immediateInstallment.periodLabel,
            adjustmentType: "CASH_ADVANCE",
            label: `Cash advance repayment ${immediateInstallment.sequenceNumber}/${normalizeCashAdvanceRepaymentPeriodValue(updated.repaymentPeriod)}`,
            amount: immediateInstallment.amount,
            createdById: actorId,
            adjustmentKind: "DEDUCTION",
          },
        });

        await tx.cashAdvanceInstallment.update({
          where: { id: immediateInstallment.id },
          data: {
            payrollAdjustmentId: immediateAdjustment.id,
          },
        });

        for (const installment of createdInstallments.slice(1)) {
          const scheduledAdjustment = await tx.attendantPayrollAdjustment.create({
            data: {
              attendantId: updated.userId,
              periodKey: installment.periodKey,
              periodLabel: installment.periodLabel,
              adjustmentType: "CASH_ADVANCE",
              label: `Cash advance repayment ${installment.sequenceNumber}/${normalizeCashAdvanceRepaymentPeriodValue(updated.repaymentPeriod)}`,
              amount: installment.amount,
              createdById: actorId,
              adjustmentKind: "DEDUCTION",
            },
          });

          await tx.cashAdvanceInstallment.update({
            where: { id: installment.id },
            data: {
              payrollAdjustmentId: scheduledAdjustment.id,
            },
          });
        }

      }

      const salaryCapOverrideApplied =
        decision === "APPROVED" &&
        auth.role === "ADMIN" &&
        salaryCapacity !== null &&
        (salaryCapacity.salary <= 0 || approvedAmount > salaryCapacity.availableToBorrow);

      await tx.actionLog.create({
        data: {
          actorId,
          entity: "CashAdvance",
          entityId: id,
          action: decision,
          before: existing as unknown as Prisma.InputJsonValue,
          after: {
            ...updated,
            schedules,
            salaryCapacity,
            salaryCapOverrideApplied,
          } as Prisma.InputJsonValue,
        },
      });

      const finalRecord = await tx.cashAdvance.findUnique({
        where: { id },
        include: {
          installments: {
            orderBy: [{ dueDate: "asc" }],
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
      const recipient = await tx.user.findUnique({
        where: { id: existing.userId },
        select: { name: true, phone: true },
      });
      return { updated: finalRecord, recipient, previous: existing };
    });

    if (decision === "APPROVED") {
      await notifyCashAdvanceApproved({
        recipient: result.recipient ?? {},
        requestedAmount: Number(result.previous.requestedAmount ?? 0),
        approvedAmount: Number(result.updated?.approvedAmount ?? approvedAmount),
        repaymentPeriod: Number(result.updated?.repaymentPeriod ?? repaymentPeriod),
        hrComment,
      });
    } else {
      await notifyCashAdvanceRejected({
        recipient: result.recipient ?? {},
        requestedAmount: Number(result.previous.requestedAmount ?? 0),
        approvedAmount: null,
        repaymentPeriod: Number(result.updated?.repaymentPeriod ?? 0),
        hrComment,
      });
    }

    return NextResponse.json({ updated: result.updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update cash advance";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
