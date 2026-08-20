import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canonicalReceiptNumber, buildReceiptKey as buildDatedReceiptKey } from "@/lib/receipts/utils";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { COMMISSION_LADDER } from "@/lib/commissionCommon";
import { loadPodDeliveryFeeMap } from "@/lib/podDeliveryFee";
import { getMarketingProductActivity, getTradingPeriodDateKeys } from "@/lib/marketingProductActivity";

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export type MarketingPeriodTotals = {
  totalSales: number;
  totalProfit: number;
  totalReceipts: number;
  totalItems: number;
  totalNewProducts: number;
  totalEditedProducts: number;
  totalCopiedProducts: number;
  walkInsServed: number;
  walkInsPurchased: number;
  paymentStats: {
    totalSalesMpesa: number;
    totalSalesCash: number;
    countMpesaReceipts: number;
    countCashReceipts: number;
  };
};

type SummarizeResult = {
  totals: MarketingPeriodTotals;
  entryCount: number;
  rawRowCount: number;
  // per-receipt breakdown keyed by canonical receipt id used by this summarizer
  perReceipts?: Record<string, { sales: number; profit: number; items: number; mpesa: number; cash: number }>;
};

const emptyTotals = (): MarketingPeriodTotals => ({
  totalSales: 0,
  totalProfit: 0,
  totalReceipts: 0,
  totalItems: 0,
  totalNewProducts: 0,
  totalEditedProducts: 0,
  totalCopiedProducts: 0,
  walkInsServed: 0,
  walkInsPurchased: 0,
  paymentStats: {
    totalSalesMpesa: 0,
    totalSalesCash: 0,
    countMpesaReceipts: 0,
    countCashReceipts: 0,
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number => {
  if (value === null || typeof value === "undefined") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeMethod = (method: unknown): "CASH" | "MPESA" => {
  if (typeof method !== "string") return "MPESA";
  return method.toUpperCase() === "CASH" ? "CASH" : "MPESA";
};

const deriveReceiptsFromSales = (sales: { receiptNumber: string | null; paymentMethod: string | null }[]) => {
  if (!sales.length) return 0;
  const keys = new Set<string>();
  sales.forEach((sale, index) => {
    const method = normalizeMethod(sale.paymentMethod);
    const receiptKey = sale.receiptNumber && sale.receiptNumber.trim().length > 0 ? sale.receiptNumber.trim() : `unnamed-${index}`;
    keys.add(`${receiptKey}|${method}`);
  });
  return keys.size || 1;
};

export async function summarizeMarketingReportsForPeriod(opts: {
  userId: string;
  userEmail?: string | null;
  period: TradingPeriod;
  client?: PrismaClientOrTx;
}): Promise<SummarizeResult> {
  const { userId, period } = opts;
  const client = opts.client ?? prisma;
  if (!userId) {
    return { totals: emptyTotals(), entryCount: 0, rawRowCount: 0 };
  }
  const normalizedEmail =
    typeof opts.userEmail === "string" && opts.userEmail.trim().length > 0
      ? opts.userEmail.trim().toLowerCase()
      : null;
  const brendahProductActivity = normalizedEmail === "brendah@betech.co.ke"
    ? await getMarketingProductActivity({
        userId,
        ...getTradingPeriodDateKeys(period),
        client,
      })
    : null;
  const applyProductActivity = (totals: MarketingPeriodTotals) => {
    if (!brendahProductActivity) return totals;
    totals.totalNewProducts = brendahProductActivity.uploaded;
    totals.totalEditedProducts = brendahProductActivity.edited;
    totals.totalCopiedProducts = brendahProductActivity.copied;
    return totals;
  };

  // Precompute POS receipts that are POD-pending in this period. If a POS
  // receipt exists with a pending podDelivery for the same canonical receipt
  // key, prefer excluding marketing rows for that canonical key to avoid
  // double-counting until POD is finalized.
  const posPodPending = await client.receipt.findMany({
    where: { generatedAt: { gte: period.start, lte: period.end }, data: { path: ['podDelivery', 'status'], equals: 'pending' } },
    select: { id: true, data: true, order: true },
  });
  const excludedCanonicals = new Set<string>();
  for (const r of posPodPending) {
    const cand = canonicalReceiptNumber(r.order?.orderNumber ?? (r.data && (r.data as any).receiptNumber) ?? r.id);
    if (cand) excludedCanonicals.add(cand);
  }
  let rawRowCount = 0;

  const submittedByConditions: Prisma.MarketingDailyEntryWhereInput[] = [
    { submittedById: userId },
  ];
  if (normalizedEmail) {
    submittedByConditions.push({
      submittedByEmail: { equals: normalizedEmail, mode: "insensitive" },
    });
  }
  const [marketingEntries, reports] = await Promise.all([
    client.marketingDailyEntry.findMany({
      where: {
        date: { gte: period.start, lte: period.end },
        OR: submittedByConditions,
      },
      include: {
        receipts: { include: { items: true } },
        sales: true,
      },
    }),
    client.dailyReport.findMany({
      where: {
        userId,
        date: { gte: period.start, lte: period.end },
      },
      include: { sales: true },
    }),
  ]);

  // If there are no marketing/daily report entries for the attendant in this
  // period, fall back to aggregating approved `WeeklySale` rows. This covers
  // workflows where weekly sales (used by Quick Stats / online summary) are
  // the authoritative source of sales but marketing entries are missing.
  if (marketingEntries.length === 0 && reports.length === 0) {
    const weeklyRows = await client.weeklySale.findMany({
      where: {
        userId,
        status: 'APPROVED',
        weekStart: { gte: period.start, lte: period.end },
      },
    });

    if (weeklyRows.length > 0) {
      const totalSales = weeklyRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const totals = emptyTotals();
      totals.totalSales = totalSales;
      // We don't have profit details on WeeklySale so leave totalProfit = 0
      totals.totalReceipts = weeklyRows.length;
      totals.totalItems = 0;
      totals.paymentStats = { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 };
      return { totals: applyProductActivity(totals), entryCount: weeklyRows.length, rawRowCount: weeklyRows.length };
    }

    return { totals: applyProductActivity(emptyTotals()), entryCount: 0, rawRowCount: 0 };
  }

  const totals = emptyTotals();
  const seenReceipts = new Set<string>();
  const perReceipts: Map<string, { sales: number; profit: number; items: number; mpesa: number; cash: number }> = new Map();
  const recKey = (s?: string | null) => (s ?? "").trim();
  const markIfNew = (key: string) => {
    const normalized = recKey(key);
    if (!normalized) return false;
    if (seenReceipts.has(normalized)) return false;
    seenReceipts.add(normalized);
    perReceipts.set(normalized, { sales: 0, profit: 0, items: 0, mpesa: 0, cash: 0 });
    return true;
  };
  const podDeliveryFeeMap = await loadPodDeliveryFeeMap(
    client,
    [
      ...marketingEntries.flatMap((entry) => [
        ...(entry.receipts ?? []).map((receipt) => receipt.receiptNumber ?? receipt.id),
        ...(entry.sales ?? []).map((sale) => (sale as any).receiptNumber ?? null),
      ]),
      ...reports.flatMap((report) => (report.sales ?? []).map((sale) => sale.receiptNumber ?? null)),
    ],
  );

  marketingEntries.forEach((entry) => {
    const entryReceiptCanonicals = new Set<string>();
    const receipts = entry.receipts ?? [];
    rawRowCount += receipts.length;
    if (receipts.length > 0) {
      receipts.forEach((receipt) => {
        const method = normalizeMethod(receipt.paymentMethod);
        const canonical =
          canonicalReceiptNumber(receipt.receiptNumber ?? receipt.id) ?? recKey(String(receipt.receiptNumber ?? receipt.id ?? ""));
        if (canonical) entryReceiptCanonicals.add(canonical);
        const canonicalKey = buildDatedReceiptKey(entry.date, canonical) ?? canonical;

        // Skip marketing receipt when a POS POD-pending receipt exists for same canonical key
        if (canonical && excludedCanonicals.has(canonical)) return;

        if (!markIfNew(canonicalKey)) {
          return;
        }

        const selling = toNumber(receipt.sellingTotal);
        const deliveryFee = podDeliveryFeeMap.get(canonical) ?? 0;
        totals.totalSales += selling;
        const stats = perReceipts.get(canonicalKey)!;
        stats.sales += selling;
        const items = receipt.items ?? [];
        const fallbackCost = items.reduce((sum, item) => sum + toNumber(item.buyingPrice), 0);
        const aggregateCost = toNumber(receipt.buyingTotal);
        const hasAggregateCost = aggregateCost > 0;
        const allItemsPriced = items.length > 0 && items.every((it) => toNumber((it as any).buyingPrice) > 0);
        if (hasAggregateCost || allItemsPriced) {
          const costToUse = hasAggregateCost ? aggregateCost : fallbackCost;
          const profitForReceipt = selling - costToUse - deliveryFee;
          totals.totalProfit += profitForReceipt;
          stats.profit += profitForReceipt;
        }

        totals.totalItems += items.length;
        stats.items += items.length;
        totals.totalReceipts += 1;
        if (method === "CASH") {
          totals.paymentStats.countCashReceipts += 1;
          totals.paymentStats.totalSalesCash += selling;
          stats.cash += selling;
        } else {
          totals.paymentStats.countMpesaReceipts += 1;
          totals.paymentStats.totalSalesMpesa += selling;
          stats.mpesa += selling;
        }
      });
    }

    const sales = entry.sales ?? [];
    rawRowCount += sales.length;
    if (sales.length > 0) {
      const entrySeen = new Set<string>();
      sales.forEach((sale, index) => {
        const method = normalizeMethod((sale as any).paymentMethod);
        const receiptIdBase = recKey((sale as any).receiptNumber) || `${entry.id}-${index}`;

        if (entrySeen.has(receiptIdBase)) return;
        entrySeen.add(receiptIdBase);

        const canonical = canonicalReceiptNumber(receiptIdBase) ?? receiptIdBase;
        const deliveryFee = podDeliveryFeeMap.get(canonical) ?? 0;
        // If this entry already has a receipt row for the same canonical receipt id,
        // do not double-count the sale row.
        const saleCanonical = canonicalReceiptNumber((sale as any).receiptNumber);
        if (saleCanonical && entryReceiptCanonicals.has(saleCanonical)) return;
        const receiptKey = buildDatedReceiptKey(entry.date, canonical) ?? canonical;
        if (!markIfNew(receiptKey)) return;

        const selling = toNumber((sale as any).sellingPrice);
        const buying = toNumber((sale as any).buyingPrice);
        const itemsCount = Number((sale as any).itemsCount ?? 1);

        totals.totalSales += selling;
        if (buying > 0) {
          totals.totalProfit += selling - buying - deliveryFee;
        }
        totals.totalItems += itemsCount;
        totals.totalReceipts += 1;

        const stats = perReceipts.get(receiptKey)!;
        stats.sales += selling;
        if (buying > 0) stats.profit += selling - buying - deliveryFee;
        stats.items += itemsCount;

        if (method === "CASH") {
          totals.paymentStats.countCashReceipts += 1;
          totals.paymentStats.totalSalesCash += selling;
          stats.cash += selling;
        } else {
          totals.paymentStats.countMpesaReceipts += 1;
          totals.paymentStats.totalSalesMpesa += selling;
          stats.mpesa += selling;
        }
      });
    }

    // Only fall back to the entry-level totals when the entry has no structured
    // receipts or sales rows. If rows exist but were excluded (e.g. POD-pending),
    // do NOT use the fallback totals because they'd reintroduce the excluded sales.
    if ((receipts?.length ?? 0) === 0 && (sales?.length ?? 0) === 0) {
      const fallbackSales = toNumber(entry.totalSales);
      totals.totalSales += fallbackSales;
      totals.totalProfit += toNumber(entry.totalProfit);
      const fallbackKey = `${entry.id ?? entry.date?.toISOString() ?? "entry"}|fallback`;
      if (markIfNew(fallbackKey)) {
        totals.totalReceipts += 1;
        rawRowCount += 1;
      }
    }
  });

  reports.forEach((report) => {
    const tasks = isRecord(report.tasks) ? (report.tasks as Record<string, unknown>) : {};
    const metrics = isRecord(tasks.metrics) ? (tasks.metrics as Record<string, unknown>) : {};
    const totalsJson = isRecord(tasks.totals) ? (tasks.totals as Record<string, unknown>) : {};

    const profitFromMetrics =
      toNumber(metrics.totalProfit) || toNumber(metrics.profit) || toNumber(totalsJson.profit) || 0;
    const entryProfit = profitFromMetrics > 0 ? profitFromMetrics : 0;

    const receiptsFromMetrics = Math.max(0, Math.floor(toNumber(totalsJson.receipts)));
    const sales = Array.isArray(report.sales) ? report.sales : [];
    rawRowCount += sales.length;

    const entrySalesReceiptKeys = new Set<string>();
    let newReceiptCount = 0;

    sales.forEach((sale, index) => {
      const method = normalizeMethod(sale.paymentMethod);
      const receiptIdBase =
        sale.receiptNumber && sale.receiptNumber.trim().length > 0
          ? sale.receiptNumber.trim()
          : `${report.id}-${index}`;

      if (entrySalesReceiptKeys.has(receiptIdBase)) return;
      entrySalesReceiptKeys.add(receiptIdBase);

      const baseDateRaw = (report as any).date ?? (report as any).createdAt ?? null;
      const baseDate = baseDateRaw instanceof Date ? baseDateRaw : null;
      const canonical = canonicalReceiptNumber(receiptIdBase) ?? receiptIdBase;
      const receiptKey = baseDate ? (buildDatedReceiptKey(baseDate, canonical) ?? canonical) : canonical;
      if (!markIfNew(receiptKey)) return;

        const price = toNumber(sale.price);
        totals.totalSales += price;
        newReceiptCount += 1;

        const stats = perReceipts.get(receiptKey)!;
        stats.sales += price;
        stats.items += 1;

        if (method === "CASH") {
          totals.paymentStats.countCashReceipts += 1;
          totals.paymentStats.totalSalesCash += price;
          stats.cash += price;
        } else {
          totals.paymentStats.countMpesaReceipts += 1;
          totals.paymentStats.totalSalesMpesa += price;
          stats.mpesa += price;
        }
    });

    if (sales.length > 0) {
      totals.totalReceipts += newReceiptCount;
    } else if (receiptsFromMetrics > 0) {
      const fallbackKey = `daily-report-${report.id ?? ""}`;
      if (markIfNew(fallbackKey)) {
        totals.totalReceipts += receiptsFromMetrics;
        totals.totalSales += toNumber(report.totalSales);
      }
      rawRowCount += receiptsFromMetrics;
    }

    totals.totalProfit += entryProfit;
    totals.totalItems += sales.length;
    totals.totalNewProducts += report.newProducts ?? 0;
    totals.totalEditedProducts += report.productsEdited ?? 0;
    totals.totalCopiedProducts += report.copiesUploaded ?? 0;
    totals.walkInsServed += report.walkInServed ?? 0;
    totals.walkInsPurchased += report.purchasesMade ?? 0;
  });

  return {
    totals: applyProductActivity(totals),
    entryCount: marketingEntries.length + reports.length,
    rawRowCount,
    perReceipts: Object.fromEntries(Array.from(perReceipts.entries())),
  };
}

type LedgerResult = {
  updated: boolean;
  commission: number;
  totals: MarketingPeriodTotals;
  period: TradingPeriod;
  ledgerId: string | null;
};

export async function recomputeMarketingCommissionLedger(opts: {
  userId: string;
  date?: Date;
  period?: TradingPeriod;
  client?: PrismaClientOrTx;
}): Promise<LedgerResult> {
  const { userId } = opts;
  const client = opts.client ?? prisma;
  const period = opts.period ?? getTradingPeriodFor(opts.date ?? new Date());

  const { totals } = await summarizeMarketingReportsForPeriod({ userId, period, client });
  // Direct sales commission rule (new):
  // Part A: For the first KES 500,000 in sales, commission = 5% * profitWithinFirst500k
  // Part B: For sales above 500k, commission accrues toward the next ladder target
  // (prorated portion of that tier reward). Completed tier rewards are fully applied.
  let marketingCommission = 0;
  const totalSales = totals.totalSales ?? 0;
  const totalProfit = totals.totalProfit ?? 0;

  if (totalSales <= 0) {
    marketingCommission = 0;
  } else if (totalSales <= 500_000) {
    // All sales are within the base band — commission is 5% of profit (profit may be 0 if unpriced)
    marketingCommission = Math.round((Math.max(totalProfit, 0) || 0) * 0.05);
  } else {
    // Sales above 500k: compute base = 5% of profit attributable to the first 500k.
    // Estimate profit portion proportionally when per-receipt profit is not available.
    const profitPortion = totalProfit > 0 ? Math.min((500_000 / totalSales) * totalProfit, totalProfit) : 0;
    const baseCommission = Math.round(profitPortion * 0.05);

    // Now compute completed tier rewards + prorated reward for current band.
    let additional = 0;
    const ladder = [...COMMISSION_LADDER].sort((a, b) => a.min - b.min);

    if (ladder.length === 0) {
      marketingCommission = baseCommission;
    } else {
      // First band: 500k -> first ladder min (e.g., 1,000,000)
      const firstMin = ladder[0].min;
      if (totalSales <= firstMin) {
        const bandSize = firstMin - 500_000;
        const progress = Math.max(0, Math.min(totalSales - 500_000, bandSize));
        const progressPercent = bandSize > 0 ? progress / bandSize : 0;
        additional += Math.round((ladder[0].reward || 0) * progressPercent);
      } else {
        // fully reached first tier reward
        additional += ladder[0].reward || 0;

        // subsequent bands between ladder tiers
        for (let i = 0; i < ladder.length - 1; i++) {
          const start = ladder[i].min;
          const end = ladder[i + 1].min;
          const reward = ladder[i + 1].reward || 0;
          if (totalSales >= end) {
            // fully reached this next tier
            additional += reward;
            continue;
          }
          if (totalSales > start) {
            const bandSize = end - start;
            const progress = Math.max(0, Math.min(totalSales - start, bandSize));
            const progressPercent = bandSize > 0 ? progress / bandSize : 0;
            additional += Math.round(reward * progressPercent);
          }
          break;
        }

        // If beyond the last ladder entry, ensure last reward included
        if (totalSales >= ladder[ladder.length - 1].min) {
          additional += ladder[ladder.length - 1].reward || 0;
        }
      }

      marketingCommission = baseCommission + additional;
    }
  }

  if (marketingCommission === 0 && totals.totalSales === 0) {
    return { updated: false, commission: 0, totals, period, ledgerId: null };
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
  const previousMarketing = isRecord(existingDetail.marketing) ? existingDetail.marketing : null;
  const previousMarketingCommission = toNumber(previousMarketing?.commission);

  const grossBeforeMarketing = Math.max(
    0,
    toNumber(existingLedger?.grossCommission) - previousMarketingCommission,
  );
  const grossCommission = grossBeforeMarketing + marketingCommission;
  const penalties = toNumber(existingLedger?.penalties);
  const netCommission = grossCommission - penalties;

  const nextDetail = {
    ...existingDetail,
    marketing: {
      periodKey: period.key,
      totals,
      commission: marketingCommission,
      computedAt: new Date().toISOString(),
    },
  };

  // Remove any overlapping/stale CommissionLedger rows for this user
  // that reference the same marketing periodKey but have different
  // period start/end boundaries. This prevents duplicate/overlapping
  // ledger rows (often caused by timezone-normalization differences).
  try {
    await client.$executeRaw`
      DELETE FROM "CommissionLedger"
      WHERE "userId" = ${userId}
        AND (detail->'marketing'->>'periodKey') = ${period.key}
        AND NOT ("periodStart" = ${period.start} AND "periodEnd" = ${period.end})
    `;
  } catch (_) {
    // ignore; raw delete is best-effort safeguard
  }

  const ledger = await client.commissionLedger.upsert({
    where: {
      userId_periodStart_periodEnd: {
        userId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
    update: {
      grossCommission: grossCommission.toFixed(2),
      netCommission: netCommission.toFixed(2),
      commissionTotal: (Number(existingLedger?.commissionTotal ?? 0) - previousMarketingCommission + marketingCommission).toFixed(2),
      detail: nextDetail,
    },
    create: {
      userId,
      periodStart: period.start,
      periodEnd: period.end,
      grossCommission: grossCommission.toFixed(2),
      netCommission: netCommission.toFixed(2),
      commissionTotal: marketingCommission.toFixed(2),
      detail: nextDetail,
    },
  });

  return {
    updated: true,
    commission: marketingCommission,
    totals,
    period,
    ledgerId: ledger.id,
  };
}
