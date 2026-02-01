import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parseIsoDate = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
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

const resolveRangeDates = (range?: string) => {
  const now = new Date();
  switch (range) {
    case "yesterday": {
      const day = new Date(now);
      day.setDate(day.getDate() - 1);
      return { start: startOfDay(day), end: endOfDay(day), label: day.toLocaleDateString("en-KE") };
    }
    case "this-week": {
      const day = now.getDay();
      const diff = (day + 6) % 7;
      const start = startOfDay(new Date(now.setDate(now.getDate() - diff)));
      const end = endOfDay(new Date(start.getTime()));
      end.setDate(start.getDate() + 6);
      return { start, end, label: `${start.toLocaleDateString("en-KE")} - ${end.toLocaleDateString("en-KE")}` };
    }
    case "trading-period": {
      const period = getTradingPeriodFor(now);
      return {
        start: period.start,
        end: period.end,
        label: period.label ?? `${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}`,
      };
    }
    case "today":
    default: {
      const start = startOfDay(new Date());
      return { start, end: endOfDay(start), label: start.toLocaleDateString("en-KE") };
    }
  }
};

const hasPaidTag = (pod: Record<string, any> | null) => Boolean(pod?.paidAt);

const computeTotals = (records: any[]) =>
  records.reduce(
    (acc, receipt) => {
      const sale = Number((receipt.totals as any)?.total ?? receipt.order?.totalAmount ?? 0);
      const items = Array.isArray(receipt.data?.items) ? receipt.data.items : [];
      const buyingSum = items.reduce((sum, item: any) => sum + Number(item?.buyingPrice ?? 0), 0);
      const profit = buyingSum > 0 ? sale - buyingSum : 0;
      acc.totalSales += sale;
      if (buyingSum > 0) {
        acc.totalProfit += profit;
        acc.pricedCount += 1;
      } else {
        acc.awaitingPricing += 1;
      }
      if (hasPaidTag(receipt.data?.podDelivery)) {
        acc.paidAmount += sale;
      }
      return acc;
    },
    { totalSales: 0, totalProfit: 0, pricedCount: 0, awaitingPricing: 0, paidAmount: 0 }
  );

export async function GET(req: NextRequest) {
  try {
    await requireAttendant(req as unknown as Request);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }

  const url = new URL(req.url);
  const range = (url.searchParams.get("range") ?? "today").toLowerCase();
  const startParam = parseIsoDate(url.searchParams.get("start") ?? undefined);
  const endParam = parseIsoDate(url.searchParams.get("end") ?? undefined);

  const resolved = resolveRangeDates(range ?? undefined);
  const start = startParam ?? resolved.start;
  const end = endParam ?? resolved.end;
  const label = resolved.label;

  const where: Prisma.ReceiptWhereInput = {
    generatedAt: { gte: start, lte: end },
    data: { path: ["podDelivery"], not: Prisma.JsonNull },
  };

  const receipts = await prisma.receipt.findMany({
    where,
    include: { order: { include: { items: true } } },
  });

  const summary = receipts.reduce(
    (acc, receipt) => {
      const podDelivery = typeof receipt.data === "object" && receipt.data ? (receipt.data as Record<string, any>).podDelivery : null;
      const status = (podDelivery?.status ?? "pending").toString().toLowerCase();
      const paid = hasPaidTag(podDelivery);
      const sale = Number((receipt.totals as any)?.total ?? receipt.order?.totalAmount ?? 0);
      if (status === "pending") {
        acc.counts.pending += 1;
        acc.amounts.pending += sale;
      } else if (status === "delivered") {
        acc.counts.delivered += 1;
        acc.amounts.delivered += sale;
        if (paid) {
          acc.counts.paid += 1;
          acc.amounts.paid += sale;
        } else {
          acc.counts.awaitingPayment += 1;
          acc.amounts.awaitingPayment += sale;
        }
      } else if (status === "delivery_failed") {
        acc.counts.deliveryFailed += 1;
        acc.amounts.deliveryFailed += sale;
      }
      acc.totalReceipts += 1;
      return acc;
    },
    {
      counts: { pending: 0, delivered: 0, deliveryFailed: 0, paid: 0, awaitingPayment: 0 },
      amounts: { pending: 0, delivered: 0, deliveryFailed: 0, paid: 0, awaitingPayment: 0 },
      totalReceipts: 0,
    }
  );

  const totals = computeTotals(receipts);

  return NextResponse.json({
    range: label,
    start: start.toISOString(),
    end: end.toISOString(),
    summary,
    totals: {
      totalSales: totals.totalSales,
      totalProfit: totals.totalProfit,
      pricedReceipts: totals.pricedCount,
      awaitingPricing: totals.awaitingPricing,
      paidAmount: totals.paidAmount,
    },
  });
}
