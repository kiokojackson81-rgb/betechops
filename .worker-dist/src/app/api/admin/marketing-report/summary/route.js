"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const date_fns_1 = require("date-fns");
const marketingReport_1 = require("@/lib/marketingReport");
const api_1 = require("@/lib/api");
async function GET(request) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    if (!fromParam || !toParam) {
        return server_1.NextResponse.json({ error: "Missing from/to" }, { status: 400 });
    }
    const fromDate = (0, date_fns_1.startOfDay)(new Date(fromParam));
    const toDate = (0, date_fns_1.endOfDay)(new Date(toParam));
    try {
        const summary = await (0, marketingReport_1.getMarketingSummary)({ from: fromDate, to: toDate });
        return server_1.NextResponse.json(summary);
    }
    catch (err) {
        return server_1.NextResponse.json({ error: err.message || "Failed to compute summary" }, { status: 500 });
    }
}
