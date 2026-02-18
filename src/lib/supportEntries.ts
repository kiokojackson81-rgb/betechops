import { prisma } from "@/lib/prisma";
import type { TradingPeriod } from "@/lib/tradingPeriod";
import { normalizePaymentMethod } from "@/lib/receiptKey";
import { canonicalReceiptNumber, buildReceiptKey as buildDatedReceiptKey } from "@/lib/receipts/utils";

export type SupportPeriodAggregates = {
  totalSales: number;
  totalProfit: number;
  totalReceipts: number;
  totalItems: number;
  newBatteries: number;
  changedBatteries: number;
  paymentStats: { totalSalesMpesa: number; totalSalesCash: number; countMpesaReceipts: number; countCashReceipts: number };
};

export async function getSupportPeriodAggregates(opts: { userId: string; period: TradingPeriod }) {
  const { userId, period } = opts;

  // Find POS receipts with POD pending in this period and precompute canonical keys
  const posPodPending = await prisma.receipt.findMany({
    where: { generatedAt: { gte: period.start, lte: period.end }, data: { path: ['podDelivery', 'status'], equals: 'pending' } },
    select: { id: true, data: true, order: true },
  });
  const excludedCanonicals = new Set<string>();
  for (const r of posPodPending) {
    const cand = canonicalReceiptNumber(r.order?.orderNumber ?? (r.data && (r.data as any).receiptNumber) ?? r.id);
    if (cand) excludedCanonicals.add(cand);
  }

  const entries = await prisma.supportDailyEntry.findMany({
    where: {
      submittedById: userId,
      date: { gte: period.start, lte: period.end },
    },
    include: {
      receipts: {
        select: {
          id: true,
          receiptNumber: true,
          receiptKey: true,
          sellingTotal: true,
          buyingTotal: true,
          paymentMethod: true,
          createdAt: true,
          items: { select: { id: true, buyingPrice: true } },
        },
      },
      sales: {
        select: {
          id: true,
          receiptNumber: true,
          sellingPrice: true,
          buyingPrice: true,
          itemsCount: true,
          paymentMethod: true,
          createdAt: true,
        },
      },
    },
  });

  const aggregates: SupportPeriodAggregates = {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
    newBatteries: 0,
    changedBatteries: 0,
    paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 },
  };

  // Map keyed by canonical receiptKey to avoid double-counting within support
  const seen = new Map<string, { id: string; sales: number; profit: number; items: number; mpesa: number; cash: number }>();

  for (const entry of entries) {
    aggregates.newBatteries += (entry as any).newBatteries ?? 0;
    aggregates.changedBatteries += (entry as any).changedBatteries ?? 0;

    const entryReceiptCanonicals = new Set<string>();
    for (const r of entry.receipts ?? []) {
      const canonical = canonicalReceiptNumber(r.receiptNumber ?? r.id);
      if (canonical && excludedCanonicals.has(canonical)) {
        // Skip this support receipt because a pos POD-pending receipt exists
        continue;
      }
      if (canonical) entryReceiptCanonicals.add(canonical);
      const key = buildDatedReceiptKey(entry.date, r.receiptNumber ?? r.id) || `ID:${r.id}`;
      const selling = Number(r.sellingTotal ?? 0);
      const buying = Number(r.buyingTotal ?? 0);
      const itemsCount = Array.isArray(r.items) ? r.items.length : 0;
      const method = normalizePaymentMethod(r.paymentMethod);

      const existing = seen.get(key);
      if (existing) {
        // merge stats (do not increment receipt count)
        existing.sales += selling;
        existing.profit += selling - buying;
        existing.items += itemsCount;
        if (method === "CASH") {
          existing.cash += selling;
        } else {
          existing.mpesa += selling;
        }
      } else {
        seen.set(key, {
          id: r.id,
          sales: selling,
          profit: selling - buying,
          items: itemsCount,
          mpesa: method === "MPESA" ? selling : 0,
          cash: method === "CASH" ? selling : 0,
        });
      }
    }

    // Also include SupportSale rows (some entries are recorded as sales-only without receipt rows).
    // Avoid double-counting if a receipt row for the same receiptNumber exists in this entry.
    const sales = (entry as any).sales ?? [];
    if (Array.isArray(sales) && sales.length > 0) {
      const entrySeen = new Set<string>();
      for (const sale of sales) {
        const receiptNumber = (sale as any).receiptNumber ?? null;
        const saleCanonical = canonicalReceiptNumber(receiptNumber);
        if (saleCanonical && excludedCanonicals.has(saleCanonical)) continue;
        if (saleCanonical && entryReceiptCanonicals.has(saleCanonical)) continue;

        const receiptIdBase = (receiptNumber && String(receiptNumber).trim().length > 0) ? String(receiptNumber).trim() : String((sale as any).id ?? "");
        if (!receiptIdBase) continue;
        // de-dupe within entry on (receiptIdBase|method)
        const method = normalizePaymentMethod((sale as any).paymentMethod);
        const seenKey = `${receiptIdBase}|${method}`;
        if (entrySeen.has(seenKey)) continue;
        entrySeen.add(seenKey);

        const key = buildDatedReceiptKey(entry.date, receiptIdBase) || `ID:${receiptIdBase}`;
        const selling = Number((sale as any).sellingPrice ?? 0);
        const buying = Number((sale as any).buyingPrice ?? 0);
        const itemsCount = Math.max(1, Math.trunc(Number((sale as any).itemsCount ?? 1)));

        const existing = seen.get(key);
        if (existing) {
          existing.sales += selling;
          if (buying > 0) existing.profit += selling - buying;
          existing.items += itemsCount;
          if (method === "CASH") existing.cash += selling;
          else existing.mpesa += selling;
        } else {
          seen.set(key, {
            id: String((sale as any).id ?? key),
            sales: selling,
            profit: buying > 0 ? selling - buying : 0,
            items: itemsCount,
            mpesa: method === "MPESA" ? selling : 0,
            cash: method === "CASH" ? selling : 0,
          });
        }
      }
    }
  }

  // aggregate deduped receipts
  for (const [, v] of seen) {
    aggregates.totalSales += v.sales;
    aggregates.totalProfit += v.profit;
    aggregates.totalItems += v.items;
    aggregates.totalReceipts += 1;
    aggregates.paymentStats.totalSalesMpesa += v.mpesa;
    aggregates.paymentStats.totalSalesCash += v.cash;
    if (v.mpesa > 0) aggregates.paymentStats.countMpesaReceipts += 1;
    if (v.cash > 0) aggregates.paymentStats.countCashReceipts += 1;
  }

  return { entryCount: entries.length, aggregates, perReceipts: Object.fromEntries(Array.from(seen.entries())) };
}
