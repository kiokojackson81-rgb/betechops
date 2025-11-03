"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const syncPendingOrders_1 = require("@/lib/jumia/syncPendingOrders");
async function POST() {
    try {
        const results = await (0, syncPendingOrders_1.syncAllAccountsPendingOrders)();
        return server_1.NextResponse.json({ ok: true, results });
    }
    catch (error) {
        console.error("[api.jumia.sync-pending] failed", error);
        return server_1.NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}
