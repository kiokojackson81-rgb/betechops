import { prisma } from "@/lib/prisma";
import type { MarketingDailyEntry, MarketingSale, PaymentMethod, MarketingReceipt, MarketingReceiptItem } from "@prisma/client";
import { getRecentTradingPeriods, getTradingPeriodFor, TradingPeriod } from "./tradingPeriod";
import { calculateCumulativeCommission } from "./commission";
import { COMMISSION_LADDER } from "./commission";

export type MarketingSummaryDay = {
  date: string; // 'YYYY-MM-DD'
  totalSales: number;
  totalProfit: number;
  items: number;
  mpesaTotal: number;
  cashTotal: number;
};

export type MarketingSummary = {
  periodFrom: string; // ISO
  periodTo: string; // ISO
  totalSales: number;
  totalProfit: number;
  totalItems: number;
  mpesaTotal: number;
  cashTotal: number;
  commissionCumulative: number;
  nextCommissionTier: number | null;
  progressToNextTier: number; // 0-1
  days: MarketingSummaryDay[];
};

export type MarketingReportFilters = {
  from?: Date;
  to?: Date;
  dayOfWeek?: string;
  tradingPeriodKey?: string;
};

export type MarketingReportEntry = Omit<
  MarketingDailyEntry & { receipts?: (MarketingReceipt & { items: MarketingReceiptItem[] })[] },
  "totalSales" | "totalProfit" | "date" | "createdAt" | "updatedAt"
> & {
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

const computeEntryTotals = (entry: MarketingDailyEntry & { receipts?: (MarketingReceipt & { items: MarketingReceiptItem[] })[]; sales?: MarketingSale[] }) => {
  if (entry.receipts && entry.receipts.length) {
    const totalSales = entry.receipts.reduce((sum, r) => sum + toNumber(r.sellingTotal), 0);
    const totalProfit = entry.receipts.reduce(
      (sum, r) => sum + (toNumber(r.sellingTotal) - r.items.reduce((s, it) => s + toNumber(it.buyingPrice), 0)),
      0
    );
    return { totalSales, totalProfit, totalItems: entry.receipts.reduce((s, r) => s + (r.items?.length || 0), 0) };
  }
  const totalSales = toNumber(entry.totalSales);
  const totalProfit = toNumber(entry.totalProfit);
  const totalItems = entry.sales?.length ?? 0;
  return { totalSales, totalProfit, totalItems };
};

const normalizeEntry = (entry: MarketingDailyEntry & { receipts?: (MarketingReceipt & { items: MarketingReceiptItem[] })[]; sales?: MarketingSale[] }): MarketingReportEntry => {
  const totals = computeEntryTotals(entry);
  return {
    ...entry,
    date: entry.date.toISOString(),
    totalSales: totals.totalSales,
    totalProfit: totals.totalProfit,
    createdAt: entry.createdAt.toISOString?.() ?? undefined,
    updatedAt: entry.updatedAt.toISOString?.() ?? undefined,
    sales: entry.sales,
    receipts: entry.receipts,
  };
};

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
    include: { sales: true, receipts: { include: { items: true } } },
  });
  const entries = entriesRaw.map(normalizeEntry);

  const totalDaysLogged = entries.length;
  const totalSales = entries.reduce((acc, e) => acc + toNumber(e.totalSales), 0);
  const totalProfit = entries.reduce((acc, e) => acc + toNumber(e.totalProfit), 0);
  const totalItems = entries.reduce((acc, e) => {
    if (e.receipts && e.receipts.length) {
      return acc + e.receipts.reduce((s, r) => s + (r.items?.length || 0), 0);
    }
    if (e.sales && e.sales.length) {
      return acc + (e.sales || []).reduce((sum, s) => sum + toNumber((s as any).itemsCount || 1), 0);
    }
    return acc;
  }, 0);
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

  const paymentStats = entries.reduce(
    (acc, e) => {
      if (e.receipts && e.receipts.length) {
        e.receipts.forEach((r) => {
          if ((r.paymentMethod as PaymentMethod) === "CASH") {
            acc.totalSalesCash += toNumber(r.sellingTotal);
            acc.countCashReceipts += 1;
          } else {
            acc.totalSalesMpesa += toNumber(r.sellingTotal);
            acc.countMpesaReceipts += 1;
          }
        });
      } else if (e.sales && e.sales.length) {
        e.sales.forEach((s) => {
          if ((s.paymentMethod as PaymentMethod) === "CASH") {
            acc.totalSalesCash += toNumber(s.sellingPrice);
            acc.countCashReceipts += 1;
          } else {
            acc.totalSalesMpesa += toNumber(s.sellingPrice);
            acc.countMpesaReceipts += 1;
          }
        });
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

export async function getMarketingSummary(opts: { from: Date; to: Date }): Promise<MarketingSummary> {
  const { from, to } = opts;

  const entries = await prisma.marketingDailyEntry.findMany({
    where: { date: { gte: from, lte: to } },
    include: { receipts: { include: { items: true } }, sales: true },
    orderBy: { date: "asc" },
  });

  const daysMap: Record<string, MarketingSummaryDay> = {};

  let totalSales = 0;
  let totalProfit = 0;
  let totalItems = 0;
  let mpesaTotal = 0;
  let cashTotal = 0;

  for (const e of entries) {
    const dateKey = e.date.toISOString().split("T")[0];
    let daySales = 0;
    let dayProfit = 0;
    let dayItems = 0;
    let dayMpesa = 0;
    let dayCash = 0;

    if (e.receipts && e.receipts.length) {
      for (const r of e.receipts) {
        const sell = Number(r.sellingTotal) || 0;
        daySales += sell;
        if ((String(r.paymentMethod || "").toUpperCase() as any) === "CASH") {
          dayCash += sell;
        } else {
          dayMpesa += sell;
        }
        const itemsSum = (r.items || []).reduce((s, it) => s + (Number(it.buyingPrice) || 0), 0);
        dayProfit += sell - itemsSum;
        dayItems += (r.items || []).length;
      }
    } else if (e.sales && e.sales.length) {
      for (const s of e.sales) {
        const sell = Number((s as any).sellingPrice ?? (s as any).sellingPrice) || Number((s as any).sellingPrice ?? 0) || 0;
        daySales += sell;
        if (String(((s as any).paymentMethod || "").toUpperCase()) === "CASH") {
          dayCash += sell;
        } else {
          dayMpesa += sell;
        }
        dayItems += Number((s as any).itemsCount ?? 1) || 0;
        // For legacy sales we don't compute per-item buyingPrice profit reliably; fallback to entry.totalProfit later
      }
      // fall back profit if entry.totalProfit present
      dayProfit = Number(e.totalProfit ?? 0) || 0;
    } else {
      daySales = Number(e.totalSales ?? 0) || 0;
      dayProfit = Number(e.totalProfit ?? 0) || 0;
    }

    daysMap[dateKey] = {
      date: dateKey,
      totalSales: Number(daySales) || 0,
      totalProfit: Number(dayProfit) || 0,
      items: Number(dayItems) || 0,
      mpesaTotal: Number(dayMpesa) || 0,
      cashTotal: Number(dayCash) || 0,
    };

    totalSales += daysMap[dateKey].totalSales;
    totalProfit += daysMap[dateKey].totalProfit;
    totalItems += daysMap[dateKey].items;
    mpesaTotal += daysMap[dateKey].mpesaTotal;
    cashTotal += daysMap[dateKey].cashTotal;
  }

  const days = Object.values(daysMap).sort((a, b) => a.date.localeCompare(b.date));

  const commissionInfo = calculateCumulativeCommission(totalSales);

  // compute progress to next tier
  const nextTarget = commissionInfo.nextTarget;
  let progressToNextTier = 0;
  if (nextTarget == null) {
    progressToNextTier = 1;
  } else {
    const prevTierMin = (COMMISSION_LADDER.filter((t) => t.min <= totalSales).map((t) => t.min).sort((a, b) => b - a)[0]) || 0;
    const denom = Math.max(1, nextTarget - prevTierMin);
    progressToNextTier = Math.max(0, Math.min(1, (totalSales - prevTierMin) / denom));
  }

  return {
    periodFrom: from.toISOString(),
    periodTo: to.toISOString(),
    totalSales: Number(totalSales) || 0,
    totalProfit: Number(totalProfit) || 0,
    totalItems: Number(totalItems) || 0,
    mpesaTotal: Number(mpesaTotal) || 0,
    cashTotal: Number(cashTotal) || 0,
    commissionCumulative: Number(commissionInfo.commission) || 0,
    nextCommissionTier: commissionInfo.nextTarget ?? null,
    progressToNextTier,
    days,
  };
}
