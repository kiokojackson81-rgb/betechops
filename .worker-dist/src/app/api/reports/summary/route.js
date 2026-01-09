"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const onlineOps_1 = require("@/lib/onlineOps");
const commission_1 = require("@/lib/commission");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") ?? "attendant";
    if (scope !== "attendant") {
        return server_1.NextResponse.json({ error: "Unsupported scope" }, { status: 400 });
    }
    const auth = await (0, auth_1.requireAttendant)(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const [quickStats, earnings] = await Promise.all([
        (0, onlineOps_1.getOnlineQuickStats)(auth.user.id),
        (0, onlineOps_1.getOnlineEarningsSummary)(auth.user.id),
    ]);
    // Ensure quick stats commission uses authoritative persisted commissionTotal when available
    if (earnings?.commissionTotal && Number(earnings.commissionTotal) > 0) {
        quickStats.commissionKes = Number(earnings.commissionTotal);
    }
    // Also expose which CommissionLedger id was selected (if any) for debugging
    try {
        const ledger = await (0, onlineOps_1.findPreferredCommissionLedger)(auth.user.id, (await (0, commission_1.getOrCreateCommissionPeriod)(new Date())).tradingPeriod);
        // attach ledgerId to quickStats for visibility
        quickStats.ledgerId = ledger?.id ?? null;
    }
    catch (e) {
        // ignore
    }
    return server_1.NextResponse.json({ scope, quickStats, earnings });
}
