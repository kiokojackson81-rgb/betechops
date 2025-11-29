import { prisma } from "@/lib/prisma";
import type { MarketingDailyEntry, MarketingSale, PaymentMethod } from "@prisma/client";
import { getRecentTradingPeriods, getTradingPeriodFor, TradingPeriod } from "./tradingPeriod";
import { calculateCumulativeCommission } from "./commission";

export type MarketingReportFilters = {
  from?: Date;
  to?: Date;
  dayOfWeek?: string;
  tradingPeriodKey?: string;
};

export type MarketingReportEntry = Omit<MarketingDailyEntry, "totalSales" | "totalProfit" | "date" | "createdAt" | "updatedAt"> & {
  totalSales: number;
  totalProfit: number;
  date: string;
  createdAt?: string;
  updatedAt?: string;
  sales?: MarketingSale[];
};

export type MarketingReportAggregates = {
  period: TradingPeriod;
  totalDaysLogged: number;
  completionRate: number;
  totalSales: number;
  totalProfit: number;
  totalItems: number;
  totalLiveSessions: number;
  totalEstimatedViewers: number;
  avgLiveDurationMinutes: number;
  topLivePlatform: string | null;
  paymentStats: {
    totalSalesMpesa: number;
    totalSalesCash: number;
    countMpesaReceipts: number;
    countCashReceipts: number;
  };
  channelStats: {
    tiktokPostedDays: number;
    tiktokRepliedDays: number;
    igFbYtPostedDays: number;
    igFbYtRepliedDays: number;
    waStatusDays: number;
    waContactsDays: number;
    waRepliedDays: number;
  };
  stockStats: { stockEnoughDays: number };
  shopStats: {
    shopCleanedDays: number;
    displayWellArrangedDays: number;
    displayWellLabeledDays: number;
  };
  commission: {
    commission: number;
    tiersReached: string[];
    nextTarget: number | null;
    nextTierReward: number | null;
  };
};

export type MarketingReportResult = {
  entries: MarketingReportEntry[];
  aggregates: MarketingReportAggregates;
};

const toNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalizeEntry = (entry: MarketingDailyEntry & { sales?: MarketingSale[] }): MarketingReportEntry => ({
  ...entry,
  date: entry.date.toISOString(),
  totalSales: toNumber(entry.totalSales),
  totalProfit: toNumber(entry.totalProfit),
  createdAt: entry.createdAt.toISOString?.() ?? undefined,
  updatedAt: entry.updatedAt.toISOString?.() ?? undefined,
  sales: entry.sales,
});

export async function getMarketingReport(params: MarketingReportFilters): Promise<MarketingReportResult> {
  const period =
    (params.tradingPeriodKey &&
      getRecentTradingPeriods(12).find((p) => p.key === params.tradingPeriodKey)) ||
    getTradingPeriodFor(new Date());

  const where: Record<string, any> = {
    date: { gte: period.start, lte: period.end },
  };
  if (params.from) where.date = { ...(where.date || {}), gte: params.from };
  if (params.to) where.date = { ...(where.date || {}), lte: params.to };
  if (params.dayOfWeek) where.dayOfWeek = params.dayOfWeek;

  const entriesRaw = await prisma.marketingDailyEntry.findMany({
    where,
    orderBy: { date: "desc" },
    include: { sales: true },
  });
  const entries = entriesRaw.map(normalizeEntry);

  const totalDaysLogged = entries.length;
  const totalSales = entries.reduce((acc, e) => acc + toNumber(e.totalSales), 0);
  const totalProfit = entries.reduce((acc, e) => acc + toNumber(e.totalProfit), 0);
  const totalItems = entries.reduce(
    (acc, e) => acc + (e.sales || []).reduce((sum, s) => sum + toNumber((s as any).itemsCount || 1), 0),
    0
  );
  const totalEstimatedViewers = entries.reduce(
    (acc, e) => acc + (e.liveSessionsEstimatedViewers ?? e.liveViewers ?? 0),
    0
  );
  const totalLiveSessions = entries.reduce(
    (acc, e) => acc + (e.liveSessionsCount ?? (e.liveSessionsEstimatedViewers || e.liveViewers ? 1 : 0)),
    0
  );

  const durations = entries
    .map((e) => e.liveSessionDurationMinutes)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
  const avgLiveDurationMinutes = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const platformFreq: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.liveSessionPlatform) {
      const p = e.liveSessionPlatform.trim();
      if (p) platformFreq[p] = (platformFreq[p] || 0) + 1;
    }
  });
  const topLivePlatform =
    Object.entries(platformFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const channelStats = {
    tiktokPostedDays: entries.filter((e) => e.tiktokPosted2Videos || e.tiktokPosted4ExplanatoryVideos || e.shot4ProductVideos).length,
    tiktokRepliedDays: entries.filter((e) => e.tiktokRepliedAll).length,
    igFbYtPostedDays: entries.filter((e) => e.igFbYtPosted2VideosEach).length,
    igFbYtRepliedDays: entries.filter((e) => e.igFbYtRepliedAll).length,
    waStatusDays: entries.filter((e) => e.waPostedStatus || e.waPosted10Statuses).length,
    waContactsDays: entries.filter((e) => e.waSavedContacts || e.waSaved10Contacts).length,
    waRepliedDays: entries.filter((e) => e.waRespondedAll).length,
  };

  const stockStats = { stockEnoughDays: entries.filter((e) => e.stockEnoughFastMovers).length };
  const shopStats = {
    shopCleanedDays: entries.filter((e) => e.shopCleaned).length,
    displayWellArrangedDays: entries.filter((e) => e.shopWellArranged).length,
    displayWellLabeledDays: entries.filter((e) => e.displayWellLabeled).length,
  };

  const salesByPayment = await prisma.marketingSale.groupBy({
    by: ["paymentMethod"],
    _sum: { sellingPrice: true },
    _count: { id: true },
    where: { entry: where },
  });

  const paymentStats = salesByPayment.reduce(
    (acc, row) => {
      const method = row.paymentMethod as PaymentMethod;
      const sum = toNumber(row._sum?.sellingPrice);
      const count = row._count?.id || 0;
      if (method === "CASH") {
        acc.totalSalesCash += sum;
        acc.countCashReceipts += count;
      } else {
        acc.totalSalesMpesa += sum;
        acc.countMpesaReceipts += count;
      }
      return acc;
    },
    { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 }
  );

  const coreTasks = ["tiktokPosted2Videos", "tiktokRepliedAll", "waPostedStatus", "waRespondedAll", "stockEnoughFastMovers"];
  const completionRate =
    totalDaysLogged === 0
      ? 0
      : Math.round(
          (entries.filter((e) => coreTasks.every((key) => Boolean((e as any)[key]))).length / totalDaysLogged) * 100
        );

  const commission = calculateCumulativeCommission(totalSales);

  return {
    entries,
    aggregates: {
      period,
      totalDaysLogged,
      completionRate,
      totalSales,
      totalProfit,
      totalItems,
      totalLiveSessions,
      totalEstimatedViewers,
      avgLiveDurationMinutes,
      topLivePlatform,
      paymentStats,
      channelStats,
      stockStats,
      shopStats,
      commission,
    },
  };
}
