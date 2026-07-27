import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import {
  assertCashAdvanceRepaymentPeriod,
  assertCashAdvanceWithinSalaryCap,
  buildCashAdvanceInstallments,
  normalizeCashAdvanceRepaymentPeriodValue,
} from "@/lib/wellness";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { notifyCashAdvanceApproved } from "@/lib/wellnessNotifications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  if (!identity.resolvedUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const advances = await prisma.cashAdvance.findMany({
    where: { userId: identity.resolvedUserId },
    include: {
      installments: {
        orderBy: [{ dueDate: "asc" }],
      },
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const normalizedAdvances = advances.map((item) => ({
    ...item,
    repaymentPeriod: normalizeCashAdvanceRepaymentPeriodValue(item.repaymentPeriod),
  }));

  return NextResponse.json(
    composeIdentityResponse(identity, {
      rows: normalizedAdvances,
      outstandingBalance: normalizedAdvances.reduce((sum, item) => sum + Number(item.remainingBalance ?? 0), 0),
    }),
  );
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? identity.actorId ?? null;
  const userId = identity.resolvedUserId;
  const actorRole = identity.actorRole;
  const isAdminCreatingForStaff = actorRole === "ADMIN" && Boolean(identity.impersonateId);
  if (!userId || !actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    requestedAmount?: number;
    reason?: string;
    repaymentPeriod?: number;
  } | null;

  const requestedAmount = Math.trunc(Number(body?.requestedAmount ?? 0));
  const repaymentPeriod = Math.trunc(Number(body?.repaymentPeriod ?? 0));
  const reason = String(body?.reason ?? "").trim();

  if (requestedAmount <= 0 || !reason) {
    return NextResponse.json({ error: "requestedAmount and reason are required" }, { status: 400 });
  }

  try {
    const normalizedRepaymentPeriod = repaymentPeriod > 0 ? assertCashAdvanceRepaymentPeriod(repaymentPeriod) : null;
    await assertCashAdvanceWithinSalaryCap(userId, requestedAmount);

    const created = await prisma.$transaction(async (tx) => {
      if (!isAdminCreatingForStaff) {
        return tx.cashAdvance.create({
          data: {
            userId,
            requestedAmount,
            reason,
            repaymentPeriod: normalizedRepaymentPeriod,
          },
          include: {
            installments: true,
          },
        });
      }

      const approvedRepaymentPeriod = normalizedRepaymentPeriod ?? 1;
      const firstReferenceDate = new Date();
      const schedules = buildCashAdvanceInstallments({
        approvedAmount: requestedAmount,
        repaymentPeriod: approvedRepaymentPeriod,
        firstPeriod: getTradingPeriodFor(firstReferenceDate),
        firstDeductionDate: firstReferenceDate,
      });

      const advance = await tx.cashAdvance.create({
        data: {
          userId,
          requestedAmount,
          approvedAmount: requestedAmount,
          reason,
          status: "APPROVED",
          repaymentPeriod: approvedRepaymentPeriod,
          installmentAmount: Math.max(...schedules.map((item) => item.amount)),
          remainingBalance: requestedAmount,
          approvedById: actorId,
          approvedAt: new Date(),
        },
      });

      for (const item of schedules) {
        const installment = await tx.cashAdvanceInstallment.create({
          data: {
            cashAdvanceId: advance.id,
            dueDate: item.dueDate,
            periodKey: item.periodKey,
            periodLabel: item.periodLabel,
            sequenceNumber: item.sequenceNumber,
            amount: item.amount,
          },
        });

        const scheduledAdjustment = await tx.attendantPayrollAdjustment.create({
          data: {
            attendantId: advance.userId,
            periodKey: item.periodKey,
            periodLabel: item.periodLabel,
            adjustmentType: "CASH_ADVANCE",
            label: `Cash advance repayment ${item.sequenceNumber}/${normalizeCashAdvanceRepaymentPeriodValue(advance.repaymentPeriod)}`,
            amount: item.amount,
            createdById: actorId,
            adjustmentKind: "DEDUCTION",
          },
        });

        await tx.cashAdvanceInstallment.update({
          where: { id: installment.id },
          data: { payrollAdjustmentId: scheduledAdjustment.id },
        });
      }

      return tx.cashAdvance.findUniqueOrThrow({
        where: { id: advance.id },
        include: {
          installments: {
            orderBy: [{ dueDate: "asc" }],
          },
        },
      });
    });

    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "CashAdvance",
        entityId: created.id,
        action: "CREATE",
        after: created as unknown as Prisma.InputJsonValue,
      },
    });

    if (isAdminCreatingForStaff) {
      const recipient = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, phone: true },
      });
      await notifyCashAdvanceApproved({
        recipient: recipient ?? {},
        requestedAmount,
        approvedAmount: requestedAmount,
        repaymentPeriod: created.repaymentPeriod,
        hrComment: "Created and approved by admin.",
      });
    }

    return NextResponse.json({ created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create cash advance request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
