"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const adminSummaryJob_1 = require("@/lib/adminSummaryJob");
const chatraceInternalFixed_1 = require("@/lib/chatraceInternalFixed");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    const result = await (0, adminSummaryJob_1.runAdminSummaryJob)({
        sendWhatsApp: false,
        advanceCutoff: false,
        useCutoff: true,
    });
    try {
        const { summary, start } = result;
        const summaryDate = start.toISOString().slice(0, 10);
        console.log('[adminSummary][manual] summaryDate=', summaryDate);
        console.log('[adminSummary][manual] payloadText=', result.payload.summaryText);
        const chatrace = await (0, chatraceInternalFixed_1.pushInternalDailySummary)({
            requestId: `manual-${summaryDate}`,
            dateLabel: summaryDate,
            totalReceipts: String(summary.receiptsCount),
            totalSales: String(summary.totalSales),
            totalProfit: String(summary.totalProfit),
            totalMpesa: String(summary.paymentTotals.mpesa.totalSales),
            totalCash: String(summary.paymentTotals.cash.totalSales),
        });
        console.log('[adminSummary][manual] chatrace result=', chatrace && chatrace.debug ? chatrace.debug : chatrace);
        return server_1.NextResponse.json({ ok: true, payload: result.payload, chatrace });
    }
    catch (e) {
        console.error('[adminSummary][manual] pushInternalDailySummary failed', e instanceof Error ? e.message : e);
        return server_1.NextResponse.json({ ok: false, error: String(e), payload: result.payload });
    }
}
