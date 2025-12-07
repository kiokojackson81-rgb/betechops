"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingEarnings_1 = require("@/lib/marketingEarnings");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const impersonate = url.searchParams.get("impersonateId") || url.searchParams.get("attendantId");
    let attendantId = null;
    try {
        if (impersonate && auth.role === "ADMIN") {
            attendantId = impersonate;
        }
        else {
            attendantId = await (0, api_1.getActorId)();
        }
    }
    catch (e) {
        attendantId = await (0, api_1.getActorId)();
    }
    if (!attendantId)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    // allow callers to specify a periodKey/periodLabel so earnings can be
    // calculated for arbitrary periods (useful for admin impersonation/tests)
    const urlObj = new URL(req.url);
    const periodKeyParam = urlObj.searchParams.get("periodKey");
    const periodLabelParam = urlObj.searchParams.get("periodLabel");
    const periodKey = periodKeyParam ?? period.key;
    const periodLabel = periodLabelParam ?? period.label;
    try {
        const summary = await (0, marketingEarnings_1.getEarningsSummaryForAttendant)({ attendantId, periodKey, periodLabel });
        return server_1.NextResponse.json({ periodKey, periodLabel, summary });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to compute earnings";
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
