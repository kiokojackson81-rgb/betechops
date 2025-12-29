import { NextRequest } from "next/server";
import { computeAdminReceiptSummary, normalizePaymentMethod } from "@/lib/adminReceiptsSummary";
import { subscribeSummary } from "@/lib/receiptSseBroker";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { parseDateParam } from "@/lib/dateRange";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const attendantId = url.searchParams.get("attendantId") || undefined;
  const paymentMethod = normalizePaymentMethod(url.searchParams.get("paymentMethod"));
  const period = getTradingPeriodFor(new Date());
  const start = parseDateParam(url.searchParams.get("start"), period.start);
  const end = parseDateParam(url.searchParams.get("end"), period.end, true);

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
