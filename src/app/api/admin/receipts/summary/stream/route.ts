import { NextRequest } from "next/server";
import { computeAdminReceiptSummary, normalizePaymentMethod } from "@/lib/adminReceiptsSummary";
import { subscribeSummary } from "@/lib/receiptSseBroker";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  if (url.searchParams.has("start") || url.searchParams.has("end")) {
    return new Response(JSON.stringify({ error: "This endpoint requires a server-resolved trading period; do not supply start/end." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const attendantId = url.searchParams.get("attendantId") || undefined;
  const paymentMethod = normalizePaymentMethod(url.searchParams.get("paymentMethod"));
  const period = getTradingPeriodFor(new Date());
  const start = startOfDay(period.start);
  const end = endOfDay(period.end);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const sendSnapshot = async () => {
        try {
          const snapshot = await computeAdminReceiptSummary({ start, end, attendantId, paymentMethod });
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
