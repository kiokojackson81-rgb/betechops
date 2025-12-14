import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { subscribeSummary } from "@/lib/receiptSseBroker";

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

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return toEnd ? endOfDay(fallback) : startOfDay(fallback);
    return toEnd ? endOfDay(parsed) : startOfDay(parsed);
  } catch (err) {
    return toEnd ? endOfDay(fallback) : startOfDay(fallback);
  }
};

const hasMissingCostData = (items: Array<{ buyingPrice: number | null; quantity?: number }>) =>
  items.length === 0 || items.some((item) => item.buyingPrice === null || item.buyingPrice === undefined);

async function computeSummary(
  start: Date,
  end: Date,
  attendantId?: string,
  paymentMethod?: "MPESA" | "CASH" | null,
) {
  const dailyEntryFilter: any = { date: { gte: start, lte: end } };
  if (attendantId) dailyEntryFilter.submittedById = attendantId;

  const [marketingReceipts, supportReceipts] = await Promise.all([
    prisma.marketingReceipt.findMany({ where: { dailyEntry: dailyEntryFilter }, include: { items: true } }),
    prisma.supportReceipt.findMany({ where: { dailyEntry: dailyEntryFilter }, include: { items: true } }),
  ]);

  const allReceipts = [
    ...marketingReceipts.map((r) => ({ ...r, type: "marketing" as const })),
    ...supportReceipts.map((r) => ({ ...r, type: "support" as const })),
  ];

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

  let totalSales = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let itemsCount = 0;
  let hasIncompleteCosts = false;

  for (const receipt of filteredReceipts) {
    const sale = Number(receipt.sellingTotal ?? 0);
    totalSales += sale;
    const items = Array.isArray(receipt.items) ? receipt.items : [];
    itemsCount += items.reduce((s: number, it: any) => s + (Number(it.quantity ?? 1) || 0), 0);
    const missingCost = hasMissingCostData(items);
    if (missingCost) {
      hasIncompleteCosts = true;
      continue;
    }
    const cost = items.reduce((sum: number, item: any) => {
      const qty = Math.max(1, Number(item.quantity ?? 1));
      return sum + qty * Number(item.buyingPrice ?? 0);
    }, 0);
    totalCost += cost;
    totalProfit += sale - cost;
  }

  const receiptsCount = filteredReceipts.length;
  const hasCompleteCosts = receiptsCount === 0 ? true : !hasIncompleteCosts;

  return {
    totalSales,
    totalCost,
    totalProfit,
    receiptsCount,
    itemsCount,
    hasCompleteCosts,
    paymentTotals,
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const attendantId = url.searchParams.get("attendantId") || undefined;
  const paymentMethod = normalizePaymentMethod(url.searchParams.get("paymentMethod"));

  const today = new Date();
  const defaultStart = startOfDay(today);
  const defaultEnd = endOfDay(today);
  const start = parseDateParam(startParam, defaultStart);
  const end = parseDateParam(endParam, defaultEnd, true);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const sendSnapshot = async () => {
        try {
          const snapshot = await computeSummary(start, end, attendantId, paymentMethod);
          const payload = JSON.stringify(snapshot);
          controller.enqueue(`data: ${payload}\n\n`);
        } catch (err) {
          console.error("[admin/receipts/summary/stream] compute error", err);
          try {
            controller.enqueue(`event: error\ndata: ${JSON.stringify({ error: 'compute_failed' })}\n\n`);
          } catch {}
        }
      };

      await sendSnapshot();

      // subscribe to broker so we can push updates immediately when receipts are created
      const onPublish = () => {
        if (closed) return;
        void sendSnapshot();
      };
      const unsubscribe = subscribeSummary(onPublish);

      // fallback periodic poll every 10s
      const iv = setInterval(() => {
        if (closed) return;
        void sendSnapshot();
      }, 10000);

      const onAbort = () => {
        closed = true;
        clearInterval(iv);
        try {
          unsubscribe();
        } catch {}
        try {
          controller.close();
        } catch {}
      };

      try {
        request.signal.addEventListener("abort", onAbort);
      } catch (e) {
        request.signal.onabort = onAbort as any;
      }
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
