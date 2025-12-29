import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export type SupportCommissionTotals = {
  totalSales: number;
  totalProfit: number;
  totalReceipts: number;
  totalItems: number;
  newBatteries: number;
  changedBatteries: number;
};

type SummarizeResult = {
  totals: SupportCommissionTotals;
  hasEntries: boolean;
};

const emptyTotals: SupportCommissionTotals = {
  totalSales: 0,
  totalProfit: 0,
  totalReceipts: 0,
  totalItems: 0,
  newBatteries: 0,
  changedBatteries: 0,
};

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function summarizeSupportEntriesForPeriod(opts: {
  userId: string;
  period: TradingPeriod;
  client?: PrismaClientOrTx;
}): Promise<SummarizeResult> {
  const { userId, period } = opts;
  const client = opts.client ?? prisma;

  // Include receipts and sales so we can validate that aggregated totals are backed
  // by explicit sales/receipts. Ignore rows that have totals but no backing details.
  const entries = await client.supportDailyEntry.findMany({
    where: {
      submittedById: userId,
      date: {
        gte: period.start,
        lte: period.end,
      },
    },
    include: {
      receipts: true,
      sales: true,
      // keep basic totals
      // Prisma will still provide totalSales/totalProfit on the root
    },
  });

  if (entries.length === 0) {
    return { totals: { ...emptyTotals }, hasEntries: false };
  }

  // Only count entries that have explicit backing: either `receipts` or `sales` rows.
  const backed = entries.filter((e) => (Array.isArray(e.receipts) && e.receipts.length > 0) || (Array.isArray(e.sales) && e.sales.length > 0));

  if (backed.length === 0) {
    // No backed entries in the period — treat as no entries to avoid awarding commission
    return { totals: { ...emptyTotals }, hasEntries: false };
  }

  const totals = backed.reduce<SupportCommissionTotals>(
    (acc, entry) => {
      acc.totalSales += Number(entry.totalSales ?? 0);
      acc.totalProfit += Number(entry.totalProfit ?? 0);
      acc.newBatteries += Number((entry.newBatteries as any) ?? 0);
      acc.changedBatteries += Number((entry.changedBatteries as any) ?? 0);
      acc.totalReceipts += Array.isArray(entry.receipts) ? entry.receipts.length : 0;
      acc.totalItems += Array.isArray(entry.receipts) ? entry.receipts.reduce((sum, receipt) => sum + (Array.isArray((receipt as any).items) ? (receipt as any).items.length : 0), 0) : 0;
      return acc;
    },
    { ...emptyTotals },
  );

  return { totals, hasEntries: true };
}

export async function recomputeSupportCommissionLedger(opts: {
  userId: string;
  period?: TradingPeriod;
  client?: PrismaClientOrTx;
  dryRun?: boolean;
}) {
  const { userId, dryRun } = opts;
  const client = opts.client ?? prisma;
  const period = opts.period ?? getTradingPeriodFor(new Date());

  const { totals, hasEntries } = await summarizeSupportEntriesForPeriod({ userId, period, client });
  if (!hasEntries) {
    return {
      updated: false,
      supportCommission: 0,
      totals,
      period,
      ledgerId: null,
    };
  }

  const fallbackCommission = Math.max(0, Math.round(totals.totalProfit * 0.05));
  const tierInfo = getCommissionSummaryForSales(totals.totalSales ?? 0);
  const tierCommission = tierInfo.commission ?? 0;
  const supportCommission = fallbackCommission + tierCommission;
  if (dryRun) {
    return {
      updated: false,
      supportCommission,
      totals,
      period,
      ledgerId: null,
    };
  }

  const existingLedger = await client.commissionLedger.findUnique({
    where: {
      userId_periodStart_periodEnd: {
        userId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
  });

  const detailValue = existingLedger?.detail;
  const existingDetail: Record<string, any> = isRecord(detailValue)
    ? { ...(detailValue as Record<string, any>) }
    : {};
  const previousSupport = isRecord(existingDetail.support) ? existingDetail.support : null;
  const previousSupportCommission =
    typeof previousSupport?.commission === "number"
      ? previousSupport.commission
      : Number(existingDetail.supportCommission ?? 0);

  const baseGross = Math.max(0, Number(existingLedger?.grossCommission ?? 0) - Number(previousSupportCommission ?? 0));
  const grossCommission = baseGross + supportCommission;
  const penalties = Number(existingLedger?.penalties ?? 0);
  const netCommission = grossCommission - penalties;

  const nextDetail = {
    ...existingDetail,
    support: {
      periodKey: period.key,
      totals,
      commission: supportCommission,
      fallbackCommission,
      tierCommission,
      computedAt: new Date().toISOString(),
    },
    supportCommission,
  };

  const ledger = await client.commissionLedger.upsert({
    where: {
      userId_periodStart_periodEnd: {
        userId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
    update: {
      grossCommission: grossCommission.toString(),
      netCommission: netCommission.toString(),
      commissionTotal: (Number(existingLedger?.commissionTotal ?? 0) - previousSupportCommission + supportCommission).toString(),
      detail: nextDetail,
    },
    create: {
      userId,
      periodStart: period.start,
      periodEnd: period.end,
      grossCommission: grossCommission.toString(),
      netCommission: netCommission.toString(),
      commissionTotal: supportCommission.toString(),
      detail: nextDetail,
    },
  });

  return {
    updated: true,
    supportCommission,
    totals,
    period,
    ledgerId: ledger.id,
  };
}
