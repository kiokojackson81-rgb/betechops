"use server";

import type { Prisma, PrismaClient } from "@prisma/client";
import { WeeklySaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import {
  computeOnlinePeriodCommission,
  resolveDirectCommissionMode,
  resolveOnlinePosOwnershipMode,
  type PeriodInputs,
} from "@/lib/onlineCommission";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";

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

  let rows: { amount: Prisma.Decimal | null }[] = [];
  try {
    rows = await client.weeklySale.findMany({
      where: {
        userId,
        status: WeeklySaleStatus.APPROVED,
        AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
      },
      select: { amount: true },
    });
  } catch (e: any) {
    // If the WeeklySale table does not exist in the connected database (Prisma P2021),
    // return an empty summary rather than letting the entire request fail.
    if ((e as any)?.code === "P2021") {
      console.warn("[weeklySales] weeklySale table not found; returning zero summary", e.message || e);
      return { totalSales: 0, entries: 0 };
    }
    throw e;
  }

  if (!rows.length) {
    return { totalSales: 0, entries: 0 };
  }

  const totalSales = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  return { totalSales, entries: rows.length };
}

export async function recomputeWeeklySalesCommission(opts: {
  userId: string | null;
  period?: TradingPeriod;
  client?: PrismaOrTx;
}) {
  const { userId } = opts;
  if (!userId) {
    return { updated: false, totalSales: 0, payout: 0, period: opts.period ?? getTradingPeriodFor(new Date()), ledgerId: null };
  }
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
  const marketplaceTotals = await getMarketplaceTotals(userId, period, client);
  const directTotals = await getDirectSalesTotals(userId, period, client);
  const user = await client.user.findUnique({ where: { id: userId }, select: { email: true } });
  const periodInputs: PeriodInputs = {
    attendantId: userId,
    periodStart: period.start,
    periodEnd: period.end,
    directSales: directTotals.sales,
    directProfit: directTotals.profit,
    jumiaSales: marketplaceTotals.jumia,
    kilimallSales: marketplaceTotals.kilimall,
  };
  const periodCommission = computeOnlinePeriodCommission(periodInputs, {
    directCommissionMode: resolveDirectCommissionMode(user?.email),
  });
  const payout = periodCommission.totalCommission;

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
  const prevOnlineRaw = nextDetail.onlineCommission;
  const previousOnline = isRecord(prevOnlineRaw) ? prevOnlineRaw : null;
  const previousTotal =
    typeof previousOnline?.totalCommission === "number"
      ? previousOnline.totalCommission
      : Number(nextDetail.onlineCommissionTotal ?? 0);

  const baseGross = Math.max(0, Number(existingLedger?.grossCommission ?? 0) - Number(previousTotal ?? 0));
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
  nextDetail.onlineCommission = {
    periodKey: period.key,
    direct: periodCommission.lines.find((line) => line.channel === "DIRECT"),
    jumia: periodCommission.lines.find((line) => line.channel === "JUMIA"),
    kilimall: periodCommission.lines.find((line) => line.channel === "KILIMALL"),
    lines: periodCommission.lines,
    totalCommission: payout,
    computedAt: new Date().toISOString(),
  };
  nextDetail.onlineCommissionTotal = payout;

  const directLine =
    periodCommission.lines.find((line) => line.channel === "DIRECT") ?? {
      channel: "DIRECT" as const,
      sales: 0,
      profit: 0,
      commission: 0,
      mode: "none" as const,
    };
  const jumiaLine =
    periodCommission.lines.find((line) => line.channel === "JUMIA") ?? {
      channel: "JUMIA" as const,
      sales: 0,
      commission: 0,
      mode: "none" as const,
    };
  const kilimallLine =
    periodCommission.lines.find((line) => line.channel === "KILIMALL") ?? {
      channel: "KILIMALL" as const,
      sales: 0,
      commission: 0,
      mode: "none" as const,
    };
  const breakdown = periodCommission.lines.map((line) => ({
    channel: line.channel,
    sales: line.sales,
    profit: line.profit ?? null,
    commission: line.commission,
    mode: line.mode,
    reason: line.reason ?? null,
  }));

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
      commissionDirect: directLine.commission.toString(),
      commissionMarketplaceJumia: jumiaLine.commission.toString(),
      commissionMarketplaceKilimall: kilimallLine.commission.toString(),
      commissionTotal: periodCommission.totalCommission.toString(),
      commissionBreakdown: breakdown,
      detail: nextDetail,
    },
    create: {
      userId,
      periodStart: period.start,
      periodEnd: period.end,
      grossCommission: grossCommission.toString(),
      netCommission: netCommission.toString(),
      commissionDirect: directLine.commission.toString(),
      commissionMarketplaceJumia: jumiaLine.commission.toString(),
      commissionMarketplaceKilimall: kilimallLine.commission.toString(),
      commissionTotal: periodCommission.totalCommission.toString(),
      commissionBreakdown: breakdown,
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

async function getMarketplaceTotals(userId: string, period: TradingPeriod, client: PrismaOrTx) {
  const entries = await client.weeklySale.findMany({
    where: {
      userId,
      status: WeeklySaleStatus.APPROVED,
      AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
    },
    select: { platform: true, amount: true },
  });
  return entries.reduce(
    (acc, entry) => {
      const value = Number(entry.amount ?? 0);
      if (entry.platform === "JUMIA") {
        acc.jumia += value;
      } else if (entry.platform === "KILIMALL") {
        acc.kilimall += value;
      }
      return acc;
    },
    { jumia: 0, kilimall: 0 },
  );
}

async function getDirectSalesTotals(userId: string, period: TradingPeriod, client: PrismaOrTx) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { email: true } });
  const totals = await summarizePosReceiptsForPeriod({
    start: period.start,
    end: period.end,
    userId,
    ownershipMode: resolveOnlinePosOwnershipMode(user?.email),
    supportPricingScope: "any",
    profitRecognitionMode: "salesDate",
  });
  return {
    sales: Number(totals.totalSales ?? 0),
    profit: Number(totals.totalProfit ?? 0),
  };
}
