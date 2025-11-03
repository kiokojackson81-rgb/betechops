"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const jumia_1 = require("@/lib/jumia");
const orderHelpers_1 = require("@/lib/jumia/orderHelpers");
exports.dynamic = "force-dynamic";
async function GET(req, ctx) {
    var _a;
    const { id } = await ctx.params;
    if (!id)
        return server_1.NextResponse.json({ error: "order id required" }, { status: 400 });
    try {
        const url = new URL(req.url);
        const shopId = url.searchParams.get("shopId") || undefined;
        const shopAuth = shopId ? await (0, jumia_1.loadShopAuthById)(shopId).catch(() => undefined) : await (0, jumia_1.loadDefaultShopAuth)();
        const resp = await (0, jumia_1.jumiaFetch)(`/orders/items?orderId=${encodeURIComponent(id)}`, shopAuth ? { shopAuth } : {});
        // Be permissive: vendor responses vary (items | orderItems | data | orders | order_items | list)
        const candidates = [
            resp === null || resp === void 0 ? void 0 : resp.items,
            resp === null || resp === void 0 ? void 0 : resp.orderItems,
            resp === null || resp === void 0 ? void 0 : resp.data,
            resp === null || resp === void 0 ? void 0 : resp.orders,
            resp === null || resp === void 0 ? void 0 : resp.order_items,
            resp === null || resp === void 0 ? void 0 : resp.list,
        ];
        const firstArray = candidates.find((v) => Array.isArray(v));
        const items = Array.isArray(firstArray) ? firstArray : [];
        // Try to infer country code from first item
        const first = (items[0] || {});
        const countryCode = ((_a = first === null || first === void 0 ? void 0 : first.country) === null || _a === void 0 ? void 0 : _a.code) || (resp === null || resp === void 0 ? void 0 : resp.country) || undefined;
        const agg = (0, orderHelpers_1.aggregateItemsDetails)(items, { countryCode });
        return server_1.NextResponse.json(Object.assign({ itemsCount: items.length, items }, agg), { headers: { "Cache-Control": "no-store" } });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return server_1.NextResponse.json({ error: msg, itemsCount: 0, items: [] }, { status: 500 });
    }
}
