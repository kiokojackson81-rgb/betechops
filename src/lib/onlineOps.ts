"use server";

import type { AttendantPayrollAdjustment, PayrollAdjustmentType, Prisma } from "@prisma/client";
import { WeeklySaleStatus } from "@prisma/client";
import type { MarketplaceAssignmentRole } from "@/lib/marketplaceAssignment";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { calculateCumulativeCommission } from "@/lib/commissionCommon";
import { getOrCreateCommissionPeriod } from "@/lib/commission";

type AssignmentWithAccount = any;

export type MarketplaceAssignmentSummary = {
  assignments: AssignmentWithAccount[];
  accountIds: string[];
  roles: MarketplaceAssignmentRole[];
};

export type OnlineQuickStats = {
  periodKey: string;
  periodLabel: string;
  receipts: number;
  salesKes: number;
  commissionKes: number;
  itemsSold: number;
  directSales: number;
  marketplaceSales: number;
  progressTarget: number;
  nextTierThreshold: number;
  remainingToNextTier: number;
};

export type OnlineEarningsSummary = {
  periodKey: string;
  periodLabel: string;
  directSales: number;
  directProfit: number;
  marketplaceSales: number;
  directCommission: number;
  marketplaceCommission: number;
  supervisorBonus: number;
  returnsDeduction: number;
  grossCommission: number;
  baseSalary: number;
  transportAllowance: number;
  bonusTotal: number;
  commissionTopUpTotal: number;
  chamaTotal: number;
  latenessTotal: number;
  disciplineTotal: number;
  otherDeductionsTotal: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  commissionTotal?: number;
};

const COMMISSION_PROGRESS_TARGET = 2_000_000;
const DIRECT_SALES_TIER_THRESHOLD = 500_000;

export async function getMarketplaceAssignmentsForUser(attendantId: string): Promise<MarketplaceAssignmentSummary> {
  const now = new Date();
  const assignments = await prisma.marketplaceAccountAssignment.findMany({
    where: {
      attendantId,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: [{ createdAt: "asc" }],
    include: { account: true },
  });
  return {
    assignments,
    accountIds: assignments.map((a) => a.accountId),
    roles: assignments.map((a) => a.role),
  };
}

export async function getOnlineQuickStats(attendantId: string, opts?: { period?: TradingPeriod }): Promise<OnlineQuickStats> {
  const period = opts?.period ?? getTradingPeriodFor(new Date());
  const { accountIds } = await getMarketplaceAssignmentsForUser(attendantId);

  const [directStats, payoutWeeks, onlineOrdersCount, earnings, weeklyManual, commissionConfig] = await Promise.all([
    getDirectSalesStats(attendantId, period),
    accountIds.length
      ? prisma.marketplacePayoutWeek.findMany({
          where: {
            accountId: { in: accountIds },
            weekEnd: { gte: period.start, lte: period.end },
          },
        })
      : Promise.resolve([]),
    accountIds.length
      ? prisma.marketplaceOrder.count({
          where: {
            accountId: { in: accountIds },
            orderedAt: { gte: period.start, lte: period.end },
          },
        })
      : Promise.resolve(0),
    getOnlineEarningsSummary(attendantId, { period }),
    getWeeklyManualSales(attendantId, period),
    getOrCreateCommissionPeriod(period.start),
  ]);

  // Prefer persisted CommissionLedger `commissionTotal` when present for this period.
  const ledger = await prisma.commissionLedger.findUnique({
    where: {
      userId_periodStart_periodEnd: {
        userId: attendantId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
  });

  const payoutSales = payoutWeeks.reduce((sum, w) => sum + Number(w.grossSales ?? 0), 0);
  const weeklyManualSales = weeklyManual.totalSales;
  const marketplaceSales = payoutSales + weeklyManualSales;
  const totalTrackedSales = directStats.sales + marketplaceSales;

  const tiers = commissionConfig?.tiers ?? [];
  let nextTierThreshold = COMMISSION_PROGRESS_TARGET;
  if (tiers.length) {
    const sorted = [...tiers].sort((a, b) => a.minSales - b.minSales);
    const upcomingTier = sorted.find((tier) => totalTrackedSales < tier.minSales);
    if (upcomingTier) {
      nextTierThreshold = upcomingTier.minSales;
    } else {
      const lastTier = sorted[sorted.length - 1];
      nextTierThreshold = lastTier.maxSales ?? lastTier.minSales;
      if (totalTrackedSales > nextTierThreshold) {
        nextTierThreshold = totalTrackedSales;
      }
    }
  }
  const remainingToNextTier = Math.max(0, nextTierThreshold - totalTrackedSales);

  return {
    periodKey: period.key,
    periodLabel: period.label,
    receipts: directStats.receipts + weeklyManual.entries,
    salesKes: totalTrackedSales,
    commissionKes: ledger ? Number(ledger.commissionTotal ?? ledger.netCommission ?? ledger.grossCommission ?? earnings.grossCommission) : earnings.grossCommission,
    itemsSold: directStats.items + onlineOrdersCount + weeklyManual.entries,
    directSales: directStats.sales,
    marketplaceSales,
    progressTarget: nextTierThreshold || COMMISSION_PROGRESS_TARGET,
    nextTierThreshold: nextTierThreshold || COMMISSION_PROGRESS_TARGET,
    remainingToNextTier,
  };
}

export async function getOnlineEarningsSummary(attendantId: string, opts?: { period?: TradingPeriod }): Promise<OnlineEarningsSummary> {
  const period = opts?.period ?? getTradingPeriodFor(new Date());
  const { accountIds, roles } = await getMarketplaceAssignmentsForUser(attendantId);

  const [directStats, payoutWeeks, plan, adjustments, returns, weeklyManual] = await Promise.all([
    getDirectSalesStats(attendantId, period),
    accountIds.length
      ? prisma.marketplacePayoutWeek.findMany({
          where: {
            accountId: { in: accountIds },
            weekEnd: { gte: period.start, lte: period.end },
          },
        })
      : Promise.resolve([]),
    prisma.attendantCompPlan.findUnique({ where: { attendantId } }),
    prisma.attendantPayrollAdjustment.findMany({
      where: { attendantId, periodKey: period.key },
    }),
    prisma.marketplaceReturn.findMany({
      where: {
        attendantId,
        status: "CHARGED_TO_ATTENDANT",
        dueAt: { gte: period.start, lte: period.end },
      },
    }),
    getWeeklyManualSales(attendantId, period),
  ]);

  const marketplaceSales = payoutWeeks.reduce((sum, w) => sum + Number(w.grossSales ?? 0), 0);
  const weeklyManualSales = weeklyManual.totalSales;
  const combinedDirectSales = directStats.sales + weeklyManualSales;
  const directSalesCommission =
    combinedDirectSales < DIRECT_SALES_TIER_THRESHOLD
      ? Math.max(0, Math.round(directStats.profit * 0.05))
      : calculateCumulativeCommission(Math.max(0, combinedDirectSales)).commission;

  const marketplaceCommission = calculateCumulativeCommission(Math.max(0, marketplaceSales)).commission;
  const isSupervisor = roles.includes("SUPERVISOR");
  const supervisorBonus = isSupervisor ? computeSupervisorBonus(marketplaceSales) : 0;
  const returnsDeduction = returns.reduce((sum, entry) => sum + Number(entry.expectedAmount ?? 0), 0);

  const grossCommission = directSalesCommission + marketplaceCommission + supervisorBonus - returnsDeduction;
  const baseSalary = plan?.baseSalary ?? 0;
  const transportAllowance = plan?.defaultTransportAllowance ?? 0;

  const summed = sumAdjustments(adjustments);

  const totalEarnings = baseSalary + transportAllowance + grossCommission + summed.bonusTotal + summed.commissionTopUpTotal;
  const totalDeductions = summed.chamaTotal + summed.latenessTotal + summed.disciplineTotal + summed.otherDeductionsTotal;
  const netPay = totalEarnings - totalDeductions;

  // Prefer persisted CommissionLedger `commissionTotal` when present for this period.
  const ledger = await prisma.commissionLedger.findUnique({
    where: {
      userId_periodStart_periodEnd: {
        userId: attendantId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
  });

  const commissionTotal = ledger && Number(ledger.commissionTotal ?? 0) > 0 ? Number(ledger.commissionTotal) : grossCommission;

  return {
    periodKey: period.key,
    periodLabel: period.label,
    directSales: combinedDirectSales,
    directProfit: directStats.profit,
    marketplaceSales,
    directCommission: directSalesCommission,
    marketplaceCommission,
    supervisorBonus,
    returnsDeduction,
    grossCommission,
    baseSalary,
    transportAllowance,
    bonusTotal: summed.bonusTotal,
    commissionTopUpTotal: summed.commissionTopUpTotal,
    chamaTotal: summed.chamaTotal,
    latenessTotal: summed.latenessTotal,
    disciplineTotal: summed.disciplineTotal,
    otherDeductionsTotal: summed.otherDeductionsTotal,
    totalEarnings,
    totalDeductions,
    netPay,
    commissionTotal,
  };
}

async function getDirectSalesStats(attendantId: string, period: TradingPeriod) {
  const entries = await prisma.supportDailyEntry.findMany({
    where: {
      submittedById: attendantId,
      date: { gte: period.start, lte: period.end },
    },
    select: {
      totalSales: true,
      totalProfit: true,
      receipts: {
        select: {
          items: { select: { id: true } },
        },
      },
    },
  });

  return entries.reduce(
    (acc, entry) => {
      acc.sales += entry.totalSales;
      acc.profit += entry.totalProfit;
      acc.receipts += entry.receipts.length;
      acc.items += entry.receipts.reduce((sum, receipt) => sum + receipt.items.length, 0);
      return acc;
    },
    { sales: 0, profit: 0, receipts: 0, items: 0 },
  );
}

async function getWeeklyManualSales(attendantId: string, period: TradingPeriod) {
  const summary = await prisma.weeklySale.aggregate({
    _sum: { amount: true },
    _count: { _all: true },
    where: {
      userId: attendantId,
      status: WeeklySaleStatus.APPROVED,
      AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
    },
  });

  const entries =
    typeof summary._count === "number" ? summary._count : summary._count?._all ?? 0;

  return {
    totalSales: Number(summary._sum?.amount ?? 0),
    entries,
  };
}

function sumAdjustments(adjustments: AttendantPayrollAdjustment[]): {
  bonusTotal: number;
  commissionTopUpTotal: number;
  chamaTotal: number;
  latenessTotal: number;
  disciplineTotal: number;
  otherDeductionsTotal: number;
} {
  const sum = (types: PayrollAdjustmentType[]) =>
    adjustments
      .filter((a) => types.includes(a.adjustmentType))
      .reduce((acc, a) => acc + (a.amount ?? 0), 0);

  return {
    bonusTotal: sum(["BONUS"]),
    commissionTopUpTotal: sum(["COMMISSION_TOPUP"]),
    chamaTotal: sum(["CHAMA"]),
    latenessTotal: sum(["LATENESS"]),
    disciplineTotal: sum(["DISCIPLINE"]),
    otherDeductionsTotal: sum(["OTHER"]),
  };
}

function computeSupervisorBonus(totalSales: number) {
  if (totalSales < 10_000_000) return 0;
  const millions = Math.floor(totalSales / 1_000_000);
  const over = Math.max(0, millions - 9);
  return over * 10_000;
}
