"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jumia");
async function POST(req) {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const body = (await req.json().catch(() => ({})));
    const shopId = String(body.shopId || '').trim();
    const ids = Array.isArray(body.orderItemIds) ? body.orderItemIds.filter(Boolean) : [];
    if (!shopId || !ids.length)
        return server_1.NextResponse.json({ error: 'shopId and orderItemIds are required' }, { status: 400 });
    const providers = await (0, jumia_1.getShipmentProviders)({ shopId, orderItemIds: ids }).catch((e) => ({ error: String(e) }));
    return server_1.NextResponse.json(providers);
}
