import { prisma } from "@/lib/prisma";
import type { TradingPeriod } from "@/lib/tradingPeriod";
import { normalizePaymentMethod } from "@/lib/receiptKey";
import { canonicalReceiptNumber, buildReceiptKey as buildDatedReceiptKey } from "@/lib/receipts/utils";
import { loadPodDeliveryFeeMap } from "@/lib/podDeliveryFee";

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

  const allReceiptCanonicals = new Set<string>();
  const saleReceiptCanonicals = new Set<string>();
  for (const entry of entries) {
    for (const receipt of entry.receipts ?? []) {
      const canonical =
        canonicalReceiptNumber(receipt.receiptNumber ?? undefined) ??
        canonicalReceiptNumber(receipt.receiptKey ?? undefined);
      if (canonical) allReceiptCanonicals.add(canonical);
    }
    for (const sale of entry.sales ?? []) {
      const canonical = canonicalReceiptNumber(sale.receiptNumber ?? undefined);
      if (canonical) saleReceiptCanonicals.add(canonical);
    }
  }

  const receiptExistenceByCanonical = new Set<string>(allReceiptCanonicals);
  if (saleReceiptCanonicals.size > 0) {
    const receiptRows = await prisma.supportReceipt.findMany({
      where: {
        OR: [
          { receiptNumber: { in: Array.from(saleReceiptCanonicals) } },
          { receiptKey: { in: Array.from(saleReceiptCanonicals) } },
        ],
      },
      select: { receiptNumber: true, receiptKey: true },
    });
    for (const row of receiptRows) {
      const canonical =
        canonicalReceiptNumber(row.receiptNumber ?? undefined) ??
        canonicalReceiptNumber(row.receiptKey ?? undefined);
      if (canonical) receiptExistenceByCanonical.add(canonical);
    }
  }

  const aggregates: SupportPeriodAggregates = {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
    newBatteries: 0,
    changedBatteries: 0,
    paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 },
  };
  const podDeliveryFeeMap = await loadPodDeliveryFeeMap(
    prisma,
    [
      ...Array.from(allReceiptCanonicals),
      ...Array.from(saleReceiptCanonicals),
    ],
  );

  // Map keyed by canonical receiptKey to avoid double-counting within support
  const seen = new Map<string, { id: string; sales: number; profit: number; items: number; mpesa: number; cash: number }>();
  const deliveryFeeAppliedKeys = new Set<string>();

  for (const entry of entries) {
    aggregates.newBatteries += (entry as any).newBatteries ?? 0;
    aggregates.changedBatteries += (entry as any).changedBatteries ?? 0;

    for (const r of entry.receipts ?? []) {
      const canonical = canonicalReceiptNumber(r.receiptNumber ?? r.id);
      if (canonical && excludedCanonicals.has(canonical)) {
        // Skip this support receipt because a pos POD-pending receipt exists
        continue;
      }
      const key = buildDatedReceiptKey(entry.date, r.receiptNumber ?? r.id) || `ID:${r.id}`;
      const selling = Number(r.sellingTotal ?? 0);
      const buying = Number(r.buyingTotal ?? 0);
      const itemsCount = Array.isArray(r.items) ? r.items.length : 0;
      const method = normalizePaymentMethod(r.paymentMethod);
      const deliveryFee = canonical ? podDeliveryFeeMap.get(canonical) ?? 0 : 0;
      const feeForKey = deliveryFeeAppliedKeys.has(key) ? 0 : deliveryFee;
      const recognizedProfit = Math.max(0, selling - buying - feeForKey);

      const existing = seen.get(key);
      if (existing) {
        // merge stats (do not increment receipt count)
        existing.sales += selling;
        existing.profit += recognizedProfit;
        existing.items += itemsCount;
        if (method === "CASH") {
          existing.cash += selling;
        } else {
          existing.mpesa += selling;
        }
      } else {
        if (feeForKey > 0) deliveryFeeAppliedKeys.add(key);
        seen.set(key, {
          id: r.id,
          sales: selling,
          profit: recognizedProfit,
          items: itemsCount,
          mpesa: method === "MPESA" ? selling : 0,
          cash: method === "CASH" ? selling : 0,
        });
      }
    }

    // SupportReceipt is authoritative when present. SupportSale remains a fallback for
    // legacy sales-only entries and must never be counted as another receipt/item row.
    const sales = (entry as any).sales ?? [];
    if (Array.isArray(sales) && sales.length > 0) {
      const entrySeen = new Set<string>();
      for (const sale of sales) {
        const receiptNumber = (sale as any).receiptNumber ?? null;
        const saleCanonical = canonicalReceiptNumber(receiptNumber);
        if (saleCanonical && excludedCanonicals.has(saleCanonical)) continue;
        if (saleCanonical && receiptExistenceByCanonical.has(saleCanonical)) continue;

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
        const deliveryFee = saleCanonical ? podDeliveryFeeMap.get(saleCanonical) ?? 0 : 0;
        const feeForKey = deliveryFeeAppliedKeys.has(key) ? 0 : deliveryFee;
        const salesValue = selling;
        const profitValue = buying > 0 ? Math.max(0, selling - buying - feeForKey) : 0;

        const existing = seen.get(key);
        if (existing) {
          existing.sales += salesValue;
          if (buying > 0) existing.profit += profitValue;
          existing.items += itemsCount;
          if (method === "CASH") existing.cash += salesValue;
          else existing.mpesa += salesValue;
        } else {
          if (feeForKey > 0) deliveryFeeAppliedKeys.add(key);
          seen.set(key, {
            id: String((sale as any).id ?? key),
            sales: salesValue,
            profit: profitValue,
            items: itemsCount,
            mpesa: method === "MPESA" ? salesValue : 0,
            cash: method === "CASH" ? salesValue : 0,
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
