"use server";

import type {
  AttendantPayrollAdjustment,
  MarketplaceAssignmentRole,
  PayrollAdjustmentType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { calculateCumulativeCommission } from "@/lib/commissionCommon";

type AssignmentWithAccount = Prisma.MarketplaceAccountAssignmentGetPayload<{
  include: { account: true };
}>;

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
};

const COMMISSION_PROGRESS_TARGET = 1_000_000;
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

  const [directStats, payoutWeeks, onlineOrdersCount, earnings] = await Promise.all([
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
  ]);

  const marketplaceSales = payoutWeeks.reduce((sum, w) => sum + Number(w.grossSales ?? 0), 0);

  return {
    periodKey: period.key,
    periodLabel: period.label,
    receipts: directStats.receipts,
    salesKes: directStats.sales + marketplaceSales,
    commissionKes: earnings.grossCommission,
    itemsSold: directStats.items + onlineOrdersCount,
    directSales: directStats.sales,
    marketplaceSales,
    progressTarget: COMMISSION_PROGRESS_TARGET,
  };
}

export async function getOnlineEarningsSummary(attendantId: string, opts?: { period?: TradingPeriod }): Promise<OnlineEarningsSummary> {
  const period = opts?.period ?? getTradingPeriodFor(new Date());
  const { accountIds, roles } = await getMarketplaceAssignmentsForUser(attendantId);

  const [directStats, payoutWeeks, plan, adjustments, returns] = await Promise.all([
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
  ]);

  const marketplaceSales = payoutWeeks.reduce((sum, w) => sum + Number(w.grossSales ?? 0), 0);
  const directSalesCommission =
    directStats.sales < DIRECT_SALES_TIER_THRESHOLD
      ? Math.max(0, Math.round(directStats.profit * 0.05))
      : calculateCumulativeCommission(Math.max(0, directStats.profit)).commission;

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

  return {
    periodKey: period.key,
    periodLabel: period.label,
    directSales: directStats.sales,
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
