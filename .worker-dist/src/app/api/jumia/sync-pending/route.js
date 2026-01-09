"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const syncPendingOrders_1 = require("@/lib/jumia/syncPendingOrders");
const onlineSync_1 = require("@/lib/jobs/onlineSync");
async function handle(request) {
    try {
        const results = await (0, syncPendingOrders_1.syncAllAccountsPendingOrders)();
        // Also sync marketplace delivered items (Jumia order items)
        let marketplaceSummary = null;
        try {
            marketplaceSummary = await (0, onlineSync_1.syncOnlineMarketplaceData)({ lookbackDays: Number(process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS ?? 30) });
        }
        catch (err) {
            console.error('[api.jumia.sync-pending] marketplace sync failed', err);
            marketplaceSummary = { error: String(err?.message ?? err) };
        }
        return server_1.NextResponse.json({ ok: true, results, marketplace: marketplaceSummary });
    }
    catch (error) {
        console.error("[api.jumia.sync-pending] failed", error);
        return server_1.NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}
async function POST(request) {
    return handle(request);
}
// Allow Vercel Cron to invoke via GET
async function GET(request) {
    return handle(request);
}
