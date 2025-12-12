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
  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.includes("T")
      ? `${value}T00:00:00+03:00`
      : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return toEnd ? endOfDay(fallback) : startOfDay(fallback);
  return toEnd ? endOfDay(parsed) : startOfDay(parsed);
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

    let totalSales = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let itemsCount = 0;
    let hasIncompleteCosts = false;

    for (const receipt of allReceipts) {
      const sale = Number(receipt.sellingTotal ?? 0);
      totalSales += sale;
      const items = Array.isArray(receipt.items) ? receipt.items : [];
      // count products sold by summing quantities (default 1)
      itemsCount += items.reduce((s: number, it: any) => s + (Number(it.quantity ?? 1) || 0), 0);
      const missingCost = hasMissingCostData(items);
      if (missingCost) {
        hasIncompleteCosts = true;
        continue;
      }
      // compute cost taking quantity into account
      const cost = items.reduce((sum: number, item: any) => {
        const qty = Math.max(1, Number(item.quantity ?? 1));
        return sum + qty * Number(item.buyingPrice ?? 0);
      }, 0);
      totalCost += cost;
      totalProfit += sale - cost;
    }

    const receiptsCount = allReceipts.length;
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
