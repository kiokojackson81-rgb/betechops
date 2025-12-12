import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      // If we already have a marketing record for this receiptNumber, keep it.
      if (receiptMap.has(key)) continue;
      // If key is by receiptNumber and we already have an entry keyed by id for the same
      // receiptNumber (rare), prefer the receiptNumber-keyed one. Simpler approach: insert
      // first-seen and skip duplicates.
      receiptMap.set(key, r);
    }
    const allReceipts = Array.from(receiptMap.values());

    // Total sales and items: derived from receipts in the requested day window
    let totalSales = 0;
    let itemsCount = 0;
    for (const receipt of allReceipts) {
      const sale = Number(receipt.sellingTotal ?? 0);
      totalSales += sale;
      const items = Array.isArray(receipt.items) ? receipt.items : [];
      itemsCount += items.reduce((s: number, it: any) => s + (Number(it.quantity ?? 1) || 0), 0);
    }

    const receiptsCount = allReceipts.length;

    // Compute profit attributed to this window based on when items were priced.
    // - marketingSales: these are created at the time of pricing and have explicit buying/selling prices
    // - supportReceiptItems: attribute per-item profit when the item's buyingPrice was set (use updatedAt)
    let totalProfit = 0;
    try {
      // marketingSale profits (priced during window)
      const marketingSales = await prisma.marketingSale.findMany({
        where: {
          OR: [
            { pricedAt: { gte: start, lte: end } },
            { AND: [{ pricedAt: null }, { createdAt: { gte: start, lte: end } }] },
          ],
        },
        select: { sellingPrice: true, buyingPrice: true, itemsCount: true, pricedAt: true },
      });
      for (const ms of marketingSales) {
        const sell = Number(ms.sellingPrice ?? 0);
        const buy = Number(ms.buyingPrice ?? 0);
        totalProfit += Math.max(0, sell - buy);
      }

      // supportReceiptItem profits: consider items whose buyingPrice is set and were updated in window
      const supportItems = await prisma.supportReceiptItem.findMany({
        // Select items that have a buyingPrice set and whose pricing date
        // (prefer `pricedAt` when present) falls within the window. For older
        // records where `pricedAt` is not yet populated, fall back to `updatedAt`.
        where: {
          buyingPrice: { gte: 0 },
          OR: [
            { pricedAt: { gte: start, lte: end } },
            { AND: [{ pricedAt: null }, { updatedAt: { gte: start, lte: end } }] },
          ],
        },
        include: { receipt: { select: { sellingTotal: true, items: true } } },
      });
      for (const it of supportItems) {
        const buy = Number(it.buyingPrice ?? 0);
        const receipt = it.receipt;
        const sellingTotal = Number(receipt?.sellingTotal ?? 0);
        const itemCount = Math.max(1, (receipt?.items ?? []).length || 1);
        const perItemSell = Math.round(sellingTotal / itemCount);
        totalProfit += Math.max(0, perItemSell - buy);
      }
    } catch (e) {
      console.error("[admin/receipts/summary] failed to compute priced profit", e);
    }

    // totalCost is not meaningful in this priced-by-date model; leave as null for now
    const totalCost = null;

    // if there are any receipts with missing cost data in the day, surface that as a flag
    const hasIncompleteCosts = allReceipts.some((r) => hasMissingCostData(Array.isArray(r.items) ? r.items : []));
    const hasCompleteCosts = receiptsCount === 0 ? true : !hasIncompleteCosts;

    return NextResponse.json({
      totalSales,
      totalCost,
      totalProfit,
      receiptsCount,
      itemsCount,
      hasCompleteCosts,
    });
  } catch (error) {
    console.error("[admin/receipts/summary] failed to load summary", error);
    return NextResponse.json(
      { error: "Failed to compute receipt summary" },
      { status: 500 },
    );
  }
}
