"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const fetchSyncedRows_1 = require("@/app/admin/orders/_lib/fetchSyncedRows");
const api_1 = require("@/lib/api");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const params = {
        status: url.searchParams.get("status") ?? undefined,
        country: url.searchParams.get("country") ?? undefined,
        shopId: url.searchParams.get("shopId") ?? undefined,
        dateFrom: url.searchParams.get("dateFrom") ?? undefined,
        dateTo: url.searchParams.get("dateTo") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
        size: url.searchParams.get("size") ?? undefined,
    };
    try {
        const rows = await (0, fetchSyncedRows_1.fetchSyncedRows)(params);
        const res = server_1.NextResponse.json({ orders: rows, nextToken: null, isLastPage: true });
        res.headers.set("Cache-Control", "no-store");
        return res;
    }
    catch (error) {
        console.error("[api.orders.synced] failed", error);
        return server_1.NextResponse.json({ orders: [], error: "Failed to load cached orders" }, { status: 500 });
    }
}
