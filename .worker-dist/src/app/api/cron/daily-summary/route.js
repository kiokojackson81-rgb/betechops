"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const chatraceInternalFixed_1 = require("@/lib/chatraceInternalFixed");
const adminSummaryJob_1 = require("@/lib/adminSummaryJob");
async function GET() {
    const result = await (0, adminSummaryJob_1.runAdminSummaryJob)();
    const { summary, start, payload } = result;
    const summaryDate = start.toISOString().slice(0, 10);
    console.log('[adminSummary][cron] summaryDate=', summaryDate);
    console.log('[adminSummary][cron] payloadText=', payload.summaryText);
    let chatrace = null;
    try {
        chatrace = await (0, chatraceInternalFixed_1.pushInternalDailySummary)({
            requestId: `daily-${summaryDate}`,
            dateLabel: summaryDate,
            totalReceipts: String(summary.receiptsCount),
            totalSales: String(summary.totalSales),
            totalProfit: String(summary.totalProfit),
            totalMpesa: String(summary.paymentTotals.mpesa.totalSales),
            totalCash: String(summary.paymentTotals.cash.totalSales),
        });
    }
    catch (e) {
        console.error('[adminSummary][cron] pushInternalDailySummary failed', e instanceof Error ? e.message : e);
    }
    console.log('[adminSummary][cron] chatrace result=', chatrace && chatrace.debug ? chatrace.debug : chatrace);
    return server_1.NextResponse.json({
        ok: true,
        summaryDate,
        summary,
        payload,
        chatrace,
    });
}
