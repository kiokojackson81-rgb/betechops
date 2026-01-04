"use server";

import type { AttendantPayrollAdjustment, PayrollAdjustmentType, Prisma } from "@prisma/client";
import { WeeklySaleStatus } from "@prisma/client";
import type { MarketplaceAssignmentRole } from "@/lib/marketplaceAssignment";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { calculateCumulativeCommission } from "@/lib/commissionCommon";
import { getOrCreateCommissionPeriod, computeProductCommissions } from "@/lib/commission";
import { computeDirectCommission } from "@/lib/onlineCommission";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getPeriodKeyVariantsFromDates } from "@/lib/payrollPeriodKey";

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

type PreferredLedger = Prisma.CommissionLedgerGetPayload<{
  select: {
    grossCommission: true;
    netCommission: true;
    penalties: true;
    commissionTotal: true;
    detail: true;
    createdAt: true;
  };
}> & { commissionTotal: Prisma.Decimal | null };

export async function findPreferredCommissionLedger(
  userId: string,
  period: TradingPeriod,
): Promise<PreferredLedger | null> {
  const windowMs = 24 * 60 * 60 * 1000;
  const exact = await prisma.commissionLedger.findUnique({
    where: {
      userId_periodStart_periodEnd: {
        userId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
    select: {
      id: true,
      grossCommission: true,
      netCommission: true,
      penalties: true,
      commissionTotal: true,
      detail: true,
      createdAt: true,
    },
  });
  if (exact) return exact;

  const nearPositive = await prisma.commissionLedger.findFirst({
    where: {
      userId,
      periodStart: {
        gte: new Date(period.start.getTime() - windowMs),
        lte: new Date(period.start.getTime() + windowMs),
      },
      commissionTotal: { gt: 0 },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      grossCommission: true,
      netCommission: true,
      penalties: true,
      commissionTotal: true,
      detail: true,
      createdAt: true,
    },
  });
  if (nearPositive) return nearPositive;

  const near = await prisma.commissionLedger.findFirst({
    where: {
      userId,
      periodStart: {
        gte: new Date(period.start.getTime() - windowMs),
        lte: new Date(period.start.getTime() + windowMs),
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      grossCommission: true,
      netCommission: true,
      penalties: true,
      commissionTotal: true,
      detail: true,
      createdAt: true,
    },
  });
  return near;
}

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

  const ledger = await findPreferredCommissionLedger(attendantId, period);

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

  // Prefer authoritative `earnings.commissionTotal` first (set by getOnlineEarningsSummary),
  // otherwise fall back to a persisted ledger value, or finally the computed earnings.grossCommission.
  const earningsCommission = Number(earnings.commissionTotal ?? 0);
  const ledgerCommission = ledger ? Number(ledger.commissionTotal ?? ledger.netCommission ?? ledger.grossCommission ?? 0) : 0;
  const commissionKesValue = earningsCommission > 0 ? earningsCommission : ledgerCommission > 0 ? ledgerCommission : earnings.grossCommission;

  return {
    periodKey: period.key,
    periodLabel: period.label,
    receipts: directStats.receipts + weeklyManual.entries,
    salesKes: totalTrackedSales,
    commissionKes: commissionKesValue,
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
      where: { attendantId, periodKey: { in: getPeriodKeyVariantsFromDates(period.start, period.end) } },
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
  const ledger = await findPreferredCommissionLedger(attendantId, period);

  // Special-case for Brendah: compute commission using direct-sales formula + product commissions
  // based on deduped marketing+support totals, but still allow an explicit persisted ledger
  // commissionTotal to override when present (>0).
  const user = await prisma.user.findUnique({ where: { id: attendantId }, select: { email: true } });
  const isBrendah = (user?.email ?? "").toLowerCase() === "brendah@betech.co.ke";

  let commissionTotal: number;
  if (isBrendah) {
    // build merged totals from marketing + support to avoid unpriced receipts
    const tradingPeriod = getTradingPeriodFor(new Date());
    const marketingSummary = await summarizeMarketingReportsForPeriod({ userId: attendantId, period });
    const supportSummary = await getSupportPeriodAggregates({ userId: attendantId, period });
    const marketingPer: Record<string, any> = (marketingSummary as any)?.perReceipts ?? {};
    const supportPer: Record<string, any> = (supportSummary as any)?.perReceipts ?? {};
    const merged = new Map();
    for (const [k, v] of Object.entries(marketingPer)) merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0 });
    for (const [k, v] of Object.entries(supportPer)) {
      const supportObj = { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0 };
      if (merged.has(k)) {
        const existing = merged.get(k);
        if ((existing.profit ?? 0) <= 0 && (supportObj.profit ?? 0) > 0) {
          merged.set(k, supportObj);
        }
        continue;
      }
      merged.set(k, supportObj);
    }
    let mergedSales = 0;
    let mergedProfit = 0;
    let mergedItems = 0;
    for (const [, v] of merged) {
      mergedSales += v.sales;
      mergedProfit += v.profit;
      mergedItems += v.items ?? 0;
    }

    const prodTotals = (marketingSummary && marketingSummary.totals) || {};
    const { newProductCommission, copiedCommission, editedCommission } = computeProductCommissions({
      newProducts: prodTotals.totalNewProducts ?? 0,
      copiedProducts: prodTotals.totalCopiedProducts ?? 0,
      editedProducts: prodTotals.totalEditedProducts ?? 0,
    });

    const direct = computeDirectCommission(mergedSales, mergedProfit);
    const computedGross = direct.amount + newProductCommission + copiedCommission + editedCommission + summed.commissionTopUpTotal;

    commissionTotal = ledger && Number(ledger.commissionTotal ?? 0) > 0 ? Number(ledger.commissionTotal) : computedGross;
  } else {
    commissionTotal = ledger && Number(ledger.commissionTotal ?? 0) > 0 ? Number(ledger.commissionTotal) : grossCommission;
  }

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
