"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const adminReceiptsSummary_1 = require("@/lib/adminReceiptsSummary");
const receiptSseBroker_1 = require("@/lib/receiptSseBroker");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const dateRange_1 = require("@/lib/dateRange");
const resolveTargetUser_1 = require("@/lib/resolveTargetUser");
async function GET(request) {
    const url = new URL(request.url);
    const attendantId = url.searchParams.get("attendantId") || undefined;
    const paymentMethod = (0, adminReceiptsSummary_1.normalizePaymentMethod)(url.searchParams.get("paymentMethod"));
    const docType = url.searchParams.get("docType") || undefined;
    const search = url.searchParams.get("q") || undefined;
    const scopeParam = url.searchParams.get("scope");
    const scope = scopeParam === "global" ? "global" : "mine";
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const start = (0, dateRange_1.parseDateParam)(url.searchParams.get("start"), period.start);
    const end = (0, dateRange_1.parseDateParam)(url.searchParams.get("end"), period.end, true);
    const identity = await (0, resolveTargetUser_1.resolveTargetUserId)(request);
    const userId = identity.resolvedUserId;
    if (scope === "mine" && !userId) {
        return new Response(null, { status: 401 });
    }
    const stream = new ReadableStream({
        async start(controller) {
            let closed = false;
            const sendSnapshot = async () => {
                try {
                    const snapshot = await (0, adminReceiptsSummary_1.computeAdminReceiptSummary)({
                        start,
                        end,
                        attendantId,
                        paymentMethod,
                        docType,
                        search,
                        scope,
                        currentUserId: userId,
                    });
                    const payload = JSON.stringify(snapshot);
                    controller.enqueue(`data: ${payload}\n\n`);
                }
                catch (err) {
                    console.error("[admin/receipts/summary/stream] compute error", err);
                    try {
                        controller.enqueue(`event: error\ndata: ${JSON.stringify({ error: "compute_failed" })}\n\n`);
                    }
                    catch { }
                }
            };
            await sendSnapshot();
            const onPublish = () => {
                if (closed)
                    return;
                void sendSnapshot();
            };
            const unsubscribe = (0, receiptSseBroker_1.subscribeSummary)(onPublish);
            const iv = setInterval(() => {
                if (closed)
                    return;
                void sendSnapshot();
            }, 10000);
            const onAbort = () => {
                closed = true;
                clearInterval(iv);
                try {
                    unsubscribe();
                }
                catch { }
                try {
                    controller.close();
                }
                catch { }
            };
            try {
                request.signal.addEventListener("abort", onAbort);
            }
            catch (e) {
                request.signal.onabort = onAbort;
            }
        },
        cancel() { },
    });
    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
