"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
// app/api/jumia/proxy/route.ts
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
exports.dynamic = "force-dynamic";
const ALLOW = new Set([
    "/shops", "/shops-of-master-shop",
    "/catalog/brands", "/catalog/categories", "/catalog/products", "/catalog/attribute-sets", "/catalog/stock",
    "/feeds/products/create", "/feeds/products/update", "/feeds/products/price", "/feeds/products/stock", "/feeds/products/status",
    "/feeds",
    "/orders", "/orders/items", "/orders/cancel", "/orders/pack", "/orders/ready-to-ship", "/orders/print-labels", "/orders/shipment-providers",
    "/v2/orders/pack",
    "/consignment-order", "/consignment-stock",
    "/payout-statement",
]);
function isAllowed(path) {
    if (path.startsWith("/feeds/"))
        return true;
    if (path.startsWith("/consignment-order/"))
        return true;
    return ALLOW.has(path);
}
async function POST(req) {
    var _a;
    try {
        const body = await req.json();
        const { shopId, method = "GET", path, query, payload, } = body;
        if (!path || !isAllowed(path)) {
            return server_1.NextResponse.json({ error: "Path not allowed" }, { status: 400 });
        }
        const shop = await prisma_1.prisma.shop.findUnique({ where: { id: shopId }, include: { apiCredentials: true } });
        if (!shop || !((_a = shop.apiCredentials) === null || _a === void 0 ? void 0 : _a.length)) {
            return server_1.NextResponse.json({ error: "Shop or credentials not found" }, { status: 404 });
        }
        const cred = shop.apiCredentials[0];
        const jumiaFetch = (0, jumia_1.makeJumiaFetch)({
            apiBase: cred.apiBase || "https://vendor-api.jumia.com",
            clientId: cred.apiKey,
            refreshToken: cred.apiSecret,
        });
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(query || {}))
            if (v !== undefined && v !== null)
                qs.set(k, String(v));
        const urlPath = `${path}${qs.toString() ? `?${qs}` : ""}`;
        const res = await jumiaFetch(urlPath, {
            method,
            body: payload !== undefined ? JSON.stringify(payload) : undefined,
        });
        return server_1.NextResponse.json(res);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return server_1.NextResponse.json({ error: msg || "Proxy error" }, { status: 500 });
    }
}
