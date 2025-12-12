import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { subscribeSummary } from "@/lib/receiptSseBroker";

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

const hasMissingCostData = (items: Array<{ buyingPrice: number | null; quantity?: number }>) =>
  items.length === 0 || items.some((item) => item.buyingPrice === null || item.buyingPrice === undefined);

async function computeSummary(start: Date, end: Date, attendantId?: string) {
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

  let totalSales = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let itemsCount = 0;
  let hasIncompleteCosts = false;

  for (const receipt of allReceipts) {
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

  const receiptsCount = allReceipts.length;
  const hasCompleteCosts = receiptsCount === 0 ? true : !hasIncompleteCosts;

  return { totalSales, totalCost, totalProfit, receiptsCount, itemsCount, hasCompleteCosts };
}

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

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const sendSnapshot = async () => {
        try {
          const snapshot = await computeSummary(start, end, attendantId);
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
