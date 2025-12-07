"use server";

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers } from "@/lib/commission";

type PrismaOrTx = PrismaClient | Prisma.TransactionClient;

export type WeeklySalesSummary = {
  totalSales: number;
  entries: number;
};

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function summarizeWeeklySalesForPeriod(opts: {
  userId: string;
  period: TradingPeriod;
  client?: PrismaOrTx;
}): Promise<WeeklySalesSummary> {
  const { userId, period } = opts;
  const client = opts.client ?? prisma;

  const rows = await client.weeklySale.findMany({
    where: {
      userId,
      AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
    },
    select: { amount: true },
  });

  if (!rows.length) {
    return { totalSales: 0, entries: 0 };
  }

  const totalSales = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  return { totalSales, entries: rows.length };
}

export async function recomputeWeeklySalesCommission(opts: {
  userId: string;
  period?: TradingPeriod;
  client?: PrismaOrTx;
}) {
  const { userId } = opts;
  const client = opts.client ?? prisma;
  const period = opts.period ?? getTradingPeriodFor(new Date());

  const summary = await summarizeWeeklySalesForPeriod({ userId, period, client });
  if (!summary.entries || summary.totalSales <= 0) {
    return {
      updated: false,
      totalSales: summary.totalSales,
      payout: 0,
      period,
      ledgerId: null,
    };
  }

  const { period: commissionPeriod, tiers } = await getOrCreateCommissionPeriod(period.start);
  const payout = computeSalesCommissionFromTiers(summary.totalSales, summary.totalSales, tiers, 0);

  const existingCommission = await client.attendantCommission.findFirst({
    where: { userId, periodId: commissionPeriod.id, shopId: null },
  });
  if (existingCommission) {
    await client.attendantCommission.update({
      where: { id: existingCommission.id },
      data: { sales: summary.totalSales, payout },
    });
  } else {
    await client.attendantCommission.create({
      data: {
        userId,
        periodId: commissionPeriod.id,
        shopId: null,
        sales: summary.totalSales,
        payout,
      },
    });
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
  const nextDetail: Record<string, any> = isRecord(detailValue) ? { ...detailValue } : {};
  const prevWeeklyRaw = nextDetail.onlineWeekly;
  const previousWeekly = isRecord(prevWeeklyRaw) ? prevWeeklyRaw : null;
  const previousCommission =
    typeof previousWeekly?.commission === "number"
      ? previousWeekly.commission
      : Number(nextDetail.onlineWeeklyCommission ?? 0);

  const baseGross = Math.max(0, Number(existingLedger?.grossCommission ?? 0) - Number(previousCommission ?? 0));
  const grossCommission = baseGross + payout;
  const penalties = Number(existingLedger?.penalties ?? 0);
  const netCommission = grossCommission - penalties;

  nextDetail.onlineWeekly = {
    periodKey: period.key,
    totals: summary,
    commission: payout,
    computedAt: new Date().toISOString(),
  };
  nextDetail.onlineWeeklyCommission = payout;

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
    totalSales: summary.totalSales,
    payout,
    period,
    ledgerId: ledger.id,
  };
}
