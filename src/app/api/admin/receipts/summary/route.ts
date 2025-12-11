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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return toEnd ? endOfDay(fallback) : startOfDay(fallback);
  return toEnd ? endOfDay(parsed) : startOfDay(parsed);
};

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
    const [marketingAgg, supportAgg] = await Promise.all([
      prisma.marketingReceipt.aggregate({
        where: { dailyEntry: dailyEntryFilter },
        _sum: { sellingTotal: true, buyingTotal: true },
      }),
      prisma.supportReceipt.aggregate({
        where: { dailyEntry: dailyEntryFilter },
        _sum: { sellingTotal: true, buyingTotal: true },
      }),
    ]);

    const totalSales =
      (marketingAgg._sum.sellingTotal ?? 0) + (supportAgg._sum.sellingTotal ?? 0);
    const totalCost =
      (marketingAgg._sum.buyingTotal ?? 0) + (supportAgg._sum.buyingTotal ?? 0);
    const totalProfit = totalSales - totalCost;

    return NextResponse.json({ totalSales, totalCost, totalProfit });
  } catch (error) {
    console.error("[admin/receipts/summary] failed to load summary", error);
    return NextResponse.json(
      { error: "Failed to compute receipt summary" },
      { status: 500 },
    );
  }
}
