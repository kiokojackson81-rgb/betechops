"use server";

import type { AttendantPayrollAdjustment, PayrollAdjustmentType, Prisma } from "@prisma/client";
import { WeeklySaleStatus } from "@prisma/client";
import type { MarketplaceAssignmentRole } from "@/lib/marketplaceAssignment";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { recomputeWeeklySummary } from "@/lib/jobs/recomputeWeeklySummaries";
import { calculateCumulativeCommission } from "@/lib/commissionCommon";
import { getOrCreateCommissionPeriod, computeProductCommissions } from "@/lib/commission";
import {
  computeBrendahDirectCommission,
  computeOnlinePeriodCommission,
  resolveDirectCommissionMode,
} from "@/lib/onlineCommission";
import { resolveOnlinePosOwnershipMode } from "@/lib/onlineCommission";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getPeriodKeyVariantsFromDates } from "@/lib/payrollPeriodKey";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";

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
  commissionSource?: string;
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
    id: true;
    grossCommission: true;
    netCommission: true;
    penalties: true;
    commissionTotal: true;
    detail: true;
    createdAt: true;
  };
}> & { commissionTotal: Prisma.Decimal | null };

type ReceiptRecord = {
  sales?: number;
  profit?: number;
  items?: number;
};

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
    include: {
      account: {
        select: {
          id: true,
          platform: true,
          displayName: true,
          countryCode: true,
          currency: true,
          jumiaShopSid: true,
          kilimallShopCode: true,
          isActive: true,
        },
      },
    },
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
      ? (async () => {
          const aggs = await recomputeWeeklySummary(period.start, period.end);
          return aggs.filter((a) => accountIds.includes(a.accountId));
        })()
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

  const payoutSales = payoutWeeks.reduce((sum, w) => sum + Number((w as any).totalGross ?? 0), 0);
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
  const commissionSource =
    earningsCommission > 0
      ? "earnings"
      : ledgerCommission > 0
      ? ledger?.id
        ? `ledger ${ledger.id}`
        : "ledger"
      : "computed";

  console.info(
    `[onlineQuickStats] user=${attendantId} period=${period.key} ledger=${ledger?.id ?? "none"} source=${commissionSource} value=${commissionKesValue.toFixed(
      2,
    )}`,
  );

  return {
    periodKey: period.key,
    periodLabel: period.label,
    receipts: directStats.receipts + weeklyManual.entries,
    salesKes: totalTrackedSales,
    commissionKes: commissionKesValue,
    commissionSource,
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
  const { accountIds, roles, assignments } = await getMarketplaceAssignmentsForUser(attendantId);

  const [directStats, payoutWeeks, plan, adjustments, returns, weeklyManual, user] = await Promise.all([
    getDirectSalesStats(attendantId, period),
    accountIds.length
      ? (async () => {
          const aggs = await recomputeWeeklySummary(period.start, period.end);
          return aggs.filter((a) => accountIds.includes(a.accountId));
        })()
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
    prisma.user.findUnique({ where: { id: attendantId }, select: { email: true } }),
  ]);

  const accountPlatformById = new Map(
    assignments.map((assignment) => [assignment.accountId, String(assignment.account?.platform ?? "").toUpperCase()]),
  );
  const payoutJumiaSales = payoutWeeks.reduce((sum, week) => {
    return accountPlatformById.get((week as any).accountId) === "JUMIA" ? sum + Number((week as any).totalGross ?? 0) : sum;
  }, 0);
  const payoutKilimallSales = payoutWeeks.reduce((sum, week) => {
    return accountPlatformById.get((week as any).accountId) === "KILIMALL"
      ? sum + Number((week as any).totalGross ?? 0)
      : sum;
  }, 0);
  const weeklyManualJumiaSales = Number((weeklyManual as any).jumiaSales ?? 0);
  const weeklyManualKilimallSales = Number((weeklyManual as any).kilimallSales ?? 0);
  const weeklyManualSales = weeklyManual.totalSales;
  const marketplaceSales = payoutJumiaSales + payoutKilimallSales + weeklyManualSales;
  const combinedDirectSales = directStats.sales + weeklyManualSales;
  const combinedDirectProfit = directStats.profit;

  const isSupervisor = roles.includes("SUPERVISOR");
  const returnsDeduction = returns.reduce((sum, entry) => sum + Number(entry.expectedAmount ?? 0), 0);

  const summed = sumAdjustments(adjustments);
  const directCommissionMode = resolveDirectCommissionMode(user?.email);
  const isBrendah = directCommissionMode === "BRENDAH";
  const profit10Commission =
    directCommissionMode === "PROFIT_10"
      ? computeOnlinePeriodCommission(
          {
            attendantId,
            periodStart: period.start,
            periodEnd: period.end,
            directSales: directStats.sales,
            directProfit: directStats.profit,
            jumiaSales: payoutJumiaSales + weeklyManualJumiaSales,
            kilimallSales: payoutKilimallSales + weeklyManualKilimallSales,
          },
          { directCommissionMode },
        )
      : null;
  const marketplaceCommission =
    profit10Commission != null
      ? profit10Commission.lines
          .filter((line) => line.channel === "JUMIA" || line.channel === "KILIMALL")
          .reduce((sum, line) => sum + Number(line.commission ?? 0), 0)
      : calculateCumulativeCommission(Math.max(0, marketplaceSales)).commission;
  const supervisorBonus = isSupervisor ? computeSupervisorBonus(marketplaceSales) : 0;

  let directSalesCommission: number;
  let brendahComputedCommission: number | null = null;
  let brendahMergedSales = 0;
  let brendahMergedProfit = 0;

  if (isBrendah) {
    const marketingSummary = await summarizeMarketingReportsForPeriod({ userId: attendantId, period });
    const supportSummary = await getSupportPeriodAggregates({ userId: attendantId, period });
    const marketingPer = (marketingSummary?.perReceipts ?? {}) as Record<string, ReceiptRecord>;
    const supportPer = (supportSummary?.perReceipts ?? {}) as Record<string, ReceiptRecord>;
    const merged = new Map<string, { sales: number; profit: number; items: number }>();
    const normalize = (entry: ReceiptRecord) => ({
      sales: Number(entry.sales ?? 0),
      profit: Number(entry.profit ?? 0),
      items: Number(entry.items ?? 0),
    });

    for (const [key, value] of Object.entries(marketingPer)) {
      merged.set(key, normalize(value));
    }
    for (const [key, value] of Object.entries(supportPer)) {
      const normalized = normalize(value);
      if (merged.has(key)) {
        const existing = merged.get(key)!;
        if ((existing.profit ?? 0) <= 0 && normalized.profit > 0) {
          merged.set(key, normalized);
        }
        continue;
      }
      merged.set(key, normalized);
    }

    for (const entry of merged.values()) {
      if ((entry.profit ?? 0) <= 0) continue;
      brendahMergedSales += entry.sales;
      brendahMergedProfit += entry.profit;
    }

    const direct = computeBrendahDirectCommission(brendahMergedSales, brendahMergedProfit);
    directSalesCommission = direct.amount;

    const marketingTotals = (marketingSummary && marketingSummary.totals) || {};
    const { newProductCommission, copiedCommission, editedCommission } = computeProductCommissions({
      newProducts: marketingTotals.totalNewProducts ?? 0,
      copiedProducts: marketingTotals.totalCopiedProducts ?? 0,
      editedProducts: marketingTotals.totalEditedProducts ?? 0,
    });

    const productCommissionTotal = newProductCommission + copiedCommission + editedCommission;
    brendahComputedCommission = direct.amount + productCommissionTotal + summed.commissionTopUpTotal;
  } else {
    directSalesCommission =
      directCommissionMode === "PROFIT_10"
        ? profit10Commission?.lines.find((line) => line.channel === "DIRECT")?.commission ?? 0
        : combinedDirectSales < DIRECT_SALES_TIER_THRESHOLD
          ? Math.max(0, Math.round(combinedDirectProfit * 0.05))
          : calculateCumulativeCommission(Math.max(0, combinedDirectSales)).commission;
  }

  const grossCommission = directSalesCommission + marketplaceCommission + supervisorBonus - returnsDeduction;
  const baseSalary = plan?.baseSalary ?? 0;
  const transportAllowance = plan?.defaultTransportAllowance ?? 0;

  const totalEarnings = baseSalary + transportAllowance + grossCommission + summed.bonusTotal + summed.commissionTopUpTotal;
  const totalDeductions = summed.chamaTotal + summed.latenessTotal + summed.disciplineTotal + summed.otherDeductionsTotal;
  const netPay = totalEarnings - totalDeductions;

  // Prefer persisted CommissionLedger `commissionTotal` when present for this period.
  const ledger = await findPreferredCommissionLedger(attendantId, period);
  const ledgerCommissionValue = ledger ? Number(ledger.commissionTotal ?? 0) : 0;
  let commissionTotal: number;
  let commissionSourceLabel: string;

  if (ledgerCommissionValue > 0) {
    commissionTotal = ledgerCommissionValue;
    commissionSourceLabel = `ledger${ledger?.id ? ` (${ledger.id})` : ""}`;
  } else if (isBrendah && brendahComputedCommission != null) {
    commissionTotal = brendahComputedCommission;
    commissionSourceLabel = "computed-brendah";
  } else {
    commissionTotal = grossCommission;
    commissionSourceLabel = "computed-gross";
  }

  const brendahDebug = isBrendah ? ` dedupSales=${brendahMergedSales} dedupProfit=${brendahMergedProfit}` : "";
  console.info(
    `[onlineEarningsSummary] user=${attendantId} period=${period.key} ledger=${ledger?.id ?? "none"} source=${commissionSourceLabel} total=${commissionTotal.toFixed(
      2,
    )}${brendahDebug}`,
  );

  return {
    periodKey: period.key,
    periodLabel: period.label,
    directSales: directCommissionMode === "PROFIT_10" ? directStats.sales : combinedDirectSales,
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
  const user = await prisma.user.findUnique({ where: { id: attendantId }, select: { email: true } });
  const posSummary = await summarizePosReceiptsForPeriod({
    start: period.start,
    end: period.end,
    userId: attendantId,
    ownershipMode: resolveOnlinePosOwnershipMode(user?.email),
    supportPricingScope: "any",
  });

  return {
    sales: Number(posSummary.totalSales ?? 0),
    profit: Number(posSummary.totalProfit ?? 0),
    receipts: Number(posSummary.totalReceipts ?? 0),
    items: Number(posSummary.totalItems ?? 0),
  };
}

async function getWeeklyManualSales(attendantId: string, period: TradingPeriod) {
  const [summary, byPlatform] = await Promise.all([
    prisma.weeklySale.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: {
        userId: attendantId,
        status: WeeklySaleStatus.APPROVED,
        AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
      },
    }),
    prisma.weeklySale.groupBy({
      by: ["platform"],
      _sum: { amount: true },
      where: {
        userId: attendantId,
        status: WeeklySaleStatus.APPROVED,
        AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
      },
    }),
  ]);

  const jumiaSales = byPlatform
    .filter((row) => String(row.platform).toUpperCase() === "JUMIA")
    .reduce((sum, row) => sum + Number(row._sum?.amount ?? 0), 0);
  const kilimallSales = byPlatform
    .filter((row) => String(row.platform).toUpperCase() === "KILIMALL")
    .reduce((sum, row) => sum + Number(row._sum?.amount ?? 0), 0);

  const entries =
    typeof summary._count === "number" ? summary._count : summary._count?._all ?? 0;

  return {
    totalSales: Number(summary._sum?.amount ?? 0),
    entries,
    jumiaSales,
    kilimallSales,
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
