"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const fetchSyncedRows_1 = require("@/app/admin/orders/_lib/fetchSyncedRows");
const api_1 = require("@/lib/api");
exports.dynamic = "force-dynamic";
async function GET(req) {
    var _a, _b, _c, _d, _e, _f, _g;
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const params = {
        status: (_a = url.searchParams.get("status")) !== null && _a !== void 0 ? _a : undefined,
        country: (_b = url.searchParams.get("country")) !== null && _b !== void 0 ? _b : undefined,
        shopId: (_c = url.searchParams.get("shopId")) !== null && _c !== void 0 ? _c : undefined,
        dateFrom: (_d = url.searchParams.get("dateFrom")) !== null && _d !== void 0 ? _d : undefined,
        dateTo: (_e = url.searchParams.get("dateTo")) !== null && _e !== void 0 ? _e : undefined,
        q: (_f = url.searchParams.get("q")) !== null && _f !== void 0 ? _f : undefined,
        size: (_g = url.searchParams.get("size")) !== null && _g !== void 0 ? _g : undefined,
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
