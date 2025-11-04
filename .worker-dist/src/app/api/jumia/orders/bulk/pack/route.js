"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const _helpers_1 = require("../_helpers");
async function POST(req) {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const body = (await req.json().catch(() => ({})));
    const shopId = String(body.shopId || '').trim();
    if (!shopId)
        return server_1.NextResponse.json({ error: 'shopId is required' }, { status: 400 });
    let orderIds = Array.isArray(body.orderIds) ? body.orderIds.filter(Boolean) : [];
    const limit = Math.min(Math.max(body.limit ?? 200, 1), 1000);
    if (orderIds.length === 0) {
        // fetch PENDING orders from DB for this shop
        const rows = await prisma_1.prisma.jumiaOrder.findMany({
            where: { shopId, status: 'PENDING' },
            orderBy: { updatedAt: 'desc' },
            take: limit,
            select: { id: true },
        });
        orderIds = rows.map((r) => r.id);
    }
    if (orderIds.length === 0)
        return server_1.NextResponse.json({ ok: true, message: 'No eligible orders to pack' });
    const defaultProviders = await (0, _helpers_1.loadDefaultProviders)();
    const packages = await (0, _helpers_1.resolvePackPackagesForOrders)({ shopId, orderIds, defaultProviders, maxItems: limit * 4 });
    if (packages.length === 0)
        return server_1.NextResponse.json({ ok: true, message: 'No pending items found in selected orders' });
    const resp = await (0, _helpers_1.packWithV2)(shopId, packages);
    return server_1.NextResponse.json(resp);
}
