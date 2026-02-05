"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const adminReceiptsSummary_1 = require("@/lib/adminReceiptsSummary");
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
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const summary = await (0, adminReceiptsSummary_1.computeAdminReceiptSummary)({
            start,
            end,
            attendantId,
            paymentMethod,
            docType,
            search,
            scope,
            currentUserId: userId,
        });
        return server_1.NextResponse.json(summary);
    }
    catch (error) {
        console.error("[admin/receipts/summary] failed to load summary", error);
        return server_1.NextResponse.json({ error: "Failed to compute receipt summary" }, { status: 500 });
    }
}
