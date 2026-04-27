import { Prisma, type LeaveBalance, type LeaveRequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNextTradingPeriod, getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";

type DbClient = typeof prisma | Prisma.TransactionClient;

export const TOTAL_PAID_LEAVE_DAYS = 10;
export const MAX_CASH_ADVANCE_REPAYMENT_PERIOD = 2;

const DEFAULT_LEAVE_ENTITLEMENTS = {
  annual: TOTAL_PAID_LEAVE_DAYS,
  sick: 0,
  emergency: 0,
} as const;

type LeaveUsageSnapshot = Pick<
  LeaveBalance,
  "annualUsed" | "sickUsed" | "emergencyUsed" | "annualEntitlement" | "sickEntitlement" | "emergencyEntitlement"
>;

function getPaidLeaveUsed(balance: Pick<LeaveBalance, "annualUsed" | "sickUsed" | "emergencyUsed">) {
  return Math.max(0, balance.annualUsed) + Math.max(0, balance.sickUsed) + Math.max(0, balance.emergencyUsed);
}

export function normalizePaidLeaveEntitlements<T extends LeaveUsageSnapshot>(balance: T) {
  return {
    ...balance,
    annualEntitlement: TOTAL_PAID_LEAVE_DAYS,
    sickEntitlement: 0,
    emergencyEntitlement: 0,
  };
}

function startOfDay(value: Date | string) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date | string) {
  const date = startOfDay(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function calculateLeaveDays(startDate: Date | string, endDate: Date | string) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const diff = end.getTime() - start.getTime();
  if (diff < 0) {
    throw new Error("End date must be on or after start date");
  }
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
}

export function buildLeaveBalanceSummary(balance: LeaveBalance) {
  const totalUsed = getPaidLeaveUsed(balance);
  const totalRemaining = Math.max(0, TOTAL_PAID_LEAVE_DAYS - totalUsed);

  return {
    annual: {
      entitlement: TOTAL_PAID_LEAVE_DAYS,
      used: balance.annualUsed,
      remaining: totalRemaining,
    },
    sick: {
      entitlement: TOTAL_PAID_LEAVE_DAYS,
      used: balance.sickUsed,
      remaining: totalRemaining,
    },
    emergency: {
      entitlement: TOTAL_PAID_LEAVE_DAYS,
      used: balance.emergencyUsed,
      remaining: totalRemaining,
    },
    totalEntitlement: TOTAL_PAID_LEAVE_DAYS,
    totalUsed,
    totalRemaining,
  };
}

export async function ensureLeaveBalance(userId: string, db: DbClient = prisma) {
  return db.leaveBalance.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      annualEntitlement: DEFAULT_LEAVE_ENTITLEMENTS.annual,
      sickEntitlement: DEFAULT_LEAVE_ENTITLEMENTS.sick,
      emergencyEntitlement: DEFAULT_LEAVE_ENTITLEMENTS.emergency,
    },
  });
}

function adjustLeaveUsageByType(
  type: LeaveRequestType,
  days: number,
  mode: "add" | "remove",
  current: Pick<LeaveBalance, "annualUsed" | "sickUsed" | "emergencyUsed">,
) {
  const delta = mode === "add" ? days : -days;
  if (type === "ANNUAL") {
    return { annualUsed: Math.max(0, current.annualUsed + delta) };
  }
  if (type === "SICK") {
    return { sickUsed: Math.max(0, current.sickUsed + delta) };
  }
  if (type === "EMERGENCY") {
    return { emergencyUsed: Math.max(0, current.emergencyUsed + delta) };
  }
  return {};
}

export function assertLeaveBalanceCanCover(
  balance: LeaveBalance,
  type: LeaveRequestType,
  daysRequested: number,
) {
  const summary = buildLeaveBalanceSummary(balance);
  if (type === "ANNUAL" || type === "SICK" || type === "EMERGENCY") {
    if (summary.totalRemaining < daysRequested) {
      throw new Error(`Paid leave balance is only ${summary.totalRemaining} day(s)`);
    }
  }
}

export async function syncApprovedLeaveBalance(input: {
  leaveRequestId: string;
  actorId?: string | null;
  mode: "approve" | "revoke";
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const leaveRequest = await db.leaveRequest.findUnique({
    where: { id: input.leaveRequestId },
    include: { user: true },
  });
  if (!leaveRequest) {
    throw new Error("Leave request not found");
  }

  const balance = await ensureLeaveBalance(leaveRequest.userId, db);
  const deltaPatch = adjustLeaveUsageByType(
    leaveRequest.type,
    leaveRequest.daysRequested,
    input.mode === "approve" ? "add" : "remove",
    balance,
  );
  if (Object.keys(deltaPatch).length === 0) return balance;

  return db.leaveBalance.update({
    where: { userId: leaveRequest.userId },
    data: {
      ...deltaPatch,
      ...(input.actorId ? { updatedById: input.actorId } : {}),
    },
  });
}

function roundInstallmentAmounts(total: number, periods: number) {
  const base = Math.floor(total / periods);
  const remainder = total % periods;
  return Array.from({ length: periods }, (_, index) => base + (index < remainder ? 1 : 0));
}

function sanitizeDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function buildCashAdvanceInstallments(input: {
  approvedAmount: number;
  repaymentPeriod: number;
  firstPeriod?: TradingPeriod;
}) {
  const approvedAmount = Math.trunc(Number(input.approvedAmount ?? 0));
  const repaymentPeriod = Math.trunc(Number(input.repaymentPeriod ?? 0));
  if (approvedAmount <= 0) throw new Error("Approved amount must be greater than zero");
  if (repaymentPeriod <= 0) throw new Error("Repayment period must be greater than zero");
  if (repaymentPeriod > MAX_CASH_ADVANCE_REPAYMENT_PERIOD) {
    throw new Error(`Repayment period cannot exceed ${MAX_CASH_ADVANCE_REPAYMENT_PERIOD} month(s)`);
  }

  let currentPeriod = input.firstPeriod ?? getTradingPeriodFor(new Date());
  const roundedAmounts = roundInstallmentAmounts(approvedAmount, repaymentPeriod);

  return roundedAmounts.map((amount, index) => {
    const dueDate = sanitizeDateOnly(currentPeriod.end);
    const item = {
      dueDate,
      periodKey: currentPeriod.key,
      periodLabel: currentPeriod.label,
      sequenceNumber: index + 1,
      amount,
    };
    currentPeriod = getNextTradingPeriod(currentPeriod);
    return item;
  });
}

export async function getCashAdvanceCapacity(
  userId: string,
  input?: { db?: DbClient; excludeAdvanceId?: string | null },
) {
  const db = input?.db ?? prisma;
  const [user, approvedAdvances] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        attendantCompPlan: {
          select: {
            baseSalary: true,
            isActive: true,
          },
        },
      },
    }),
    db.cashAdvance.findMany({
      where: {
        userId,
        status: "APPROVED",
        ...(input?.excludeAdvanceId ? { id: { not: input.excludeAdvanceId } } : {}),
      },
      select: {
        id: true,
        remainingBalance: true,
      },
    }),
  ]);

  const salary = Math.max(0, Number(user?.attendantCompPlan?.baseSalary ?? 0));
  const outstandingBalance = approvedAdvances.reduce((sum, item) => sum + Math.max(0, Number(item.remainingBalance ?? 0)), 0);
  const availableToBorrow = Math.max(0, salary - outstandingBalance);

  return {
    salary,
    outstandingBalance,
    availableToBorrow,
  };
}

export function assertCashAdvanceRepaymentPeriod(period: number) {
  const repaymentPeriod = Math.trunc(Number(period ?? 0));
  if (repaymentPeriod <= 0) {
    throw new Error("Repayment period must be greater than zero");
  }
  if (repaymentPeriod > MAX_CASH_ADVANCE_REPAYMENT_PERIOD) {
    throw new Error(`Repayment period cannot exceed ${MAX_CASH_ADVANCE_REPAYMENT_PERIOD} month(s)`);
  }
  return repaymentPeriod;
}

export async function assertCashAdvanceWithinSalaryCap(
  userId: string,
  amount: number,
  input?: { db?: DbClient; excludeAdvanceId?: string | null },
) {
  const requestedAmount = Math.max(0, Math.trunc(Number(amount ?? 0)));
  const capacity = await getCashAdvanceCapacity(userId, input);

  if (capacity.salary <= 0) {
    throw new Error("Cash advance is unavailable because no base salary is set");
  }
  if (requestedAmount > capacity.availableToBorrow) {
    throw new Error(
      `Cash advance exceeds salary limit. Salary is KES ${capacity.salary.toLocaleString()} and available borrowing is KES ${capacity.availableToBorrow.toLocaleString()}`,
    );
  }

  return capacity;
}

export async function getEmployeeWellnessOverview(userId: string, db: DbClient = prisma) {
  const balance = await ensureLeaveBalance(userId, db);

  const [leaveRequests, cashAdvances, upcomingInstallments, cashAdvanceCapacity] = await Promise.all([
    db.leaveRequest.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      take: 12,
    }),
    db.cashAdvance.findMany({
      where: { userId },
      include: {
        installments: {
          orderBy: [{ dueDate: "asc" }],
        },
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 12,
    }),
    db.cashAdvanceInstallment.findMany({
      where: {
        isPaid: false,
        cashAdvance: { userId },
      },
      include: {
        cashAdvance: {
          select: {
            id: true,
            approvedAmount: true,
            remainingBalance: true,
          },
        },
      },
      orderBy: [{ dueDate: "asc" }],
      take: 6,
    }),
    getCashAdvanceCapacity(userId, { db }),
  ]);

  return {
    leaveBalance: buildLeaveBalanceSummary(balance),
    leaveRequests,
    cashAdvances,
    upcomingInstallments,
    outstandingAdvanceBalance: cashAdvances.reduce((sum, item) => sum + Number(item.remainingBalance ?? 0), 0),
    cashAdvanceCapacity,
  };
}

export async function applyDueCashAdvanceInstallments(input: {
  actorId: string;
  asOf?: Date;
}) {
  const asOf = input.asOf ?? new Date();
  const dueInstallments = await prisma.cashAdvanceInstallment.findMany({
    where: {
      isPaid: false,
      dueDate: { lte: endOfDay(asOf) },
      cashAdvance: {
        status: "APPROVED",
      },
    },
    include: {
      cashAdvance: true,
    },
    orderBy: [{ dueDate: "asc" }, { sequenceNumber: "asc" }],
  });

  const processed: Array<{ installmentId: string; adjustmentId: string; amount: number }> = [];

  for (const installment of dueInstallments) {
    const existingAdjustmentId = installment.payrollAdjustmentId?.trim();
    if (existingAdjustmentId) continue;

    const adjustment = await prisma.$transaction(async (tx) => {
      const fresh = await tx.cashAdvanceInstallment.findUnique({
        where: { id: installment.id },
        include: { cashAdvance: true },
      });
      if (!fresh || fresh.isPaid || fresh.payrollAdjustmentId) return null;

      const createdAdjustment = await tx.attendantPayrollAdjustment.create({
        data: {
          attendantId: fresh.cashAdvance.userId,
          periodKey: fresh.periodKey,
          periodLabel: fresh.periodLabel,
          adjustmentType: "CASH_ADVANCE",
          label: `Cash advance repayment ${fresh.sequenceNumber}/${fresh.cashAdvance.repaymentPeriod ?? "?"}`,
          amount: fresh.amount,
          createdById: input.actorId,
          adjustmentKind: "DEDUCTION",
        },
      });

      await tx.cashAdvanceInstallment.update({
        where: { id: fresh.id },
        data: {
          isPaid: true,
          deductedAt: new Date(),
          payrollAdjustmentId: createdAdjustment.id,
        },
      });

      await tx.cashAdvance.update({
        where: { id: fresh.cashAdvanceId },
        data: {
          remainingBalance: Math.max(0, Number(fresh.cashAdvance.remainingBalance ?? 0) - Number(fresh.amount ?? 0)),
        },
      });

      await tx.actionLog.create({
        data: {
          actorId: input.actorId,
          entity: "CashAdvanceInstallment",
          entityId: fresh.id,
          action: "DEDUCTION_APPLIED",
          after: {
            cashAdvanceId: fresh.cashAdvanceId,
            payrollAdjustmentId: createdAdjustment.id,
            amount: fresh.amount,
            dueDate: fresh.dueDate.toISOString(),
          },
        },
      });

      return createdAdjustment;
    });

    if (adjustment) {
      processed.push({
        installmentId: installment.id,
        adjustmentId: adjustment.id,
        amount: Number(adjustment.amount ?? 0),
      });
    }
  }

  return {
    processedCount: processed.length,
    processed,
  };
}
