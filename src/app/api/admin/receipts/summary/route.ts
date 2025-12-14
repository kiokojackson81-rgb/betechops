import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const normalizePaymentMethod = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.toUpperCase().trim();
  if (normalized === "CASH" || normalized === "MPESA") return normalized;
  return null;
};

const startOfDay = (value: Date) => {
  const clone = new Date(value);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

const endOfDay = (value: Date) => {
  const clone = new Date(value);
  clone.setHours(23, 59, 59, 999);
  return clone;
};

const parseDateParam = (value: string | null, fallback: Date, toEnd = false) => {
  if (!value) return toEnd ? endOfDay(fallback) : startOfDay(fallback);

  // If the value is a plain YYYY-MM-DD (no time part), construct an
  // explicit Nairobi-local start/end instant so parsing is deterministic.
  const isPlainYMD = /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.includes("T");
  try {
    if (isPlainYMD) {
      const iso = toEnd ? `${value}T23:59:59.999+03:00` : `${value}T00:00:00+03:00`;
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) throw new Error("invalid date");
      return parsed;
    }

    // If a full ISO/timestamp (with T or timezone) was provided, trust it
    // as an exact instant and return it unchanged.
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return toEnd ? endOfDay(fallback) : startOfDay(fallback);
    return parsed;
  } catch (err) {
    return toEnd ? endOfDay(fallback) : startOfDay(fallback);
  }
};

const hasMissingCostData = (items: Array<{ buyingPrice: number | null; quantity?: number }>) =>
  items.length === 0 || items.some((item) => item.buyingPrice === null || item.buyingPrice === undefined);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const attendantId = url.searchParams.get("attendantId") || undefined;

  const today = new Date();
  const defaultStart = startOfDay(today);
  const defaultEnd = endOfDay(today);
  const start = parseDateParam(startParam, defaultStart);
  const end = parseDateParam(endParam, defaultEnd, true);
  const paymentMethod = normalizePaymentMethod(url.searchParams.get("paymentMethod"));

  const dailyEntryFilter: any = {
    date: { gte: start, lte: end },
  };
  if (attendantId) {
    dailyEntryFilter.submittedById = attendantId;
  }

  try {
    const [marketingReceipts, supportReceipts] = await Promise.all([
      prisma.marketingReceipt.findMany({
        where: { dailyEntry: dailyEntryFilter },
        include: { items: true },
      }),
      prisma.supportReceipt.findMany({
        where: { dailyEntry: dailyEntryFilter },
        include: { items: true },
      }),
    ]);

    // Combine marketing and support receipts but dedupe cases where both exist
    // for the same sale (they share the same receiptNumber). Prefer the
    // marketing receipt when both are present, otherwise fall back to
    // support. If no receiptNumber exists, use a stable type+id key.
    const combined = [
      ...marketingReceipts.map((receipt) => ({ ...receipt, type: "marketing" as const })),
      ...supportReceipts.map((receipt) => ({ ...receipt, type: "support" as const })),
    ];
    const receiptMap = new Map<string, any>();
    for (const r of combined) {
      const key = r.receiptNumber ? `num:${String(r.receiptNumber)}` : `id:${r.type}:${r.id}`;
      const existing = receiptMap.get(key);
      if (!existing) {
        receiptMap.set(key, r);
        continue;
      }
      // If we already have a record for this receiptNumber, prefer a support
      // receipt over a marketing one so the admin summary reflects support-side
      // buying prices when available (keeps summary consistent with receipt UI).
      if (existing.type === "marketing" && r.type === "support") {
        receiptMap.set(key, r);
      }
      // Otherwise keep the existing entry (first-seen).
    }
    const allReceipts = Array.from(receiptMap.values());
    const paymentTotals = allReceipts.reduce(
      (acc, receipt) => {
        const method = normalizePaymentMethod(receipt.paymentMethod) ?? "MPESA";
        const normalized = method.toUpperCase();
        if (!["MPESA", "CASH"].includes(normalized)) return acc;
        const bucket = normalized === "CASH" ? acc.cash : acc.mpesa;
        bucket.totalSales += Number(receipt.sellingTotal ?? 0);
        bucket.count += 1;
        return acc;
      },
      {
        mpesa: { totalSales: 0, count: 0 },
        cash: { totalSales: 0, count: 0 },
      },
    );
    const filteredReceipts = paymentMethod
      ? allReceipts.filter((receipt) => normalizePaymentMethod(receipt.paymentMethod) === paymentMethod)
      : allReceipts;

    // Total sales and items: derived from receipts in the requested day window
    let totalSales = 0;
    let itemsCount = 0;
    for (const receipt of filteredReceipts) {
      const sale = Number(receipt.sellingTotal ?? 0);
      totalSales += sale;
      const items = Array.isArray(receipt.items) ? receipt.items : [];
      itemsCount += items.reduce((s: number, it: any) => s + (Number(it.quantity ?? 1) || 0), 0);
    }

    const receiptsCount = filteredReceipts.length;

    // Compute profit following the admin UI rule:
    // Only include a receipt's cost/profit when either:
    //  - the receipt has an explicit aggregate `buyingTotal` > 0, or
    //  - every item has a positive `buyingPrice` (> 0).
    // Otherwise the receipt is considered awaiting pricing and its profit is excluded.
    let totalProfit = 0;
    let totalCost = 0;
    let awaitingPricingCount = 0;

    for (const receipt of filteredReceipts) {
      const items = Array.isArray(receipt.items) ? receipt.items : [];
      const aggregateCost = Number(receipt.buyingTotal ?? 0);
      const allItemsPriced = items.length > 0 && items.every((it) => Number(it.buyingPrice ?? 0) > 0);
      const hasAggregateCost = aggregateCost > 0;
      const sell = Number(receipt.sellingTotal ?? 0);

      if (hasAggregateCost || allItemsPriced) {
        const buyingSum = hasAggregateCost ? aggregateCost : items.reduce((s: number, it: any) => s + Number(it.buyingPrice ?? 0), 0);
        totalCost += buyingSum;
        totalProfit += sell - buyingSum;
      } else {
        awaitingPricingCount += 1;
      }
    }

    const hasIncompleteCosts = awaitingPricingCount > 0;
    const hasCompleteCosts = receiptsCount === 0 ? true : !hasIncompleteCosts;

    const paymentTotals = allReceipts.reduce(
      (acc, receipt) => {
        const method = normalizePaymentMethod(receipt.paymentMethod) ?? "MPESA";
        const normalized = method.toUpperCase();
        if (!["MPESA", "CASH"].includes(normalized)) return acc;
        acc[normalized === "CASH" ? "cash" : "mpesa"].totalSales += Number(receipt.sellingTotal ?? 0);
        acc[normalized === "CASH" ? "cash" : "mpesa"].count += 1;
        return acc;
      },
      {
        mpesa: { totalSales: 0, count: 0 },
        cash: { totalSales: 0, count: 0 },
      },
    );

    return NextResponse.json({
      totalSales,
      totalCost,
      totalProfit,
      receiptsCount,
      itemsCount,
      hasCompleteCosts,
      awaitingPricingCount,
      paymentTotals,
    });
  } catch (error) {
    console.error("[admin/receipts/summary] failed to load summary", error);
    return NextResponse.json(
      { error: "Failed to compute receipt summary" },
      { status: 500 },
    );
  }
}
