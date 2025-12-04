import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";

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

  const entries = await client.supportDailyEntry.findMany({
    where: {
      submittedById: userId,
      date: {
        gte: period.start,
        lte: period.end,
      },
    },
    select: {
      totalSales: true,
      totalProfit: true,
      newBatteries: true,
      changedBatteries: true,
      receipts: {
        select: {
          _count: {
            select: { items: true },
          },
        },
      },
    },
  });

  if (entries.length === 0) {
    return { totals: { ...emptyTotals }, hasEntries: false };
  }

  const totals = entries.reduce<SupportCommissionTotals>(
    (acc, entry) => {
      acc.totalSales += entry.totalSales;
      acc.totalProfit += entry.totalProfit;
      acc.newBatteries += entry.newBatteries;
      acc.changedBatteries += entry.changedBatteries;
      acc.totalReceipts += entry.receipts.length;
      acc.totalItems += entry.receipts.reduce((sum, receipt) => sum + (receipt._count?.items ?? 0), 0);
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

  const supportCommission = Math.max(0, Math.round(totals.totalProfit * 0.05));
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
  const existingDetail = isRecord(detailValue) ? { ...detailValue } : {};
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
      detail: nextDetail,
    },
    create: {
      userId,
      periodStart: period.start,
      periodEnd: period.end,
      grossCommission: grossCommission.toString(),
      netCommission: netCommission.toString(),
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
