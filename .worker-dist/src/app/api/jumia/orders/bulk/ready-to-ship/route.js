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
    const limit = Math.min(Math.max(body.limit ?? 400, 1), 2000);
    let orderItemIds = Array.isArray(body.orderItemIds) ? body.orderItemIds.filter(Boolean) : [];
    if (orderItemIds.length === 0) {
        let orderIds = Array.isArray(body.orderIds) ? body.orderIds.filter(Boolean) : [];
        if (orderIds.length === 0) {
            // use PACKED orders from DB as a heuristic to find items ready for RTS
            const rows = await prisma_1.prisma.jumiaOrder.findMany({
                where: { shopId, status: 'PACKED' },
                orderBy: { updatedAt: 'desc' },
                take: Math.ceil(limit / 4),
                select: { id: true },
            });
            orderIds = rows.map((r) => r.id);
            if (orderIds.length === 0) {
                // also try PENDING (in case pack just happened but DB not yet updated)
                const rows2 = await prisma_1.prisma.jumiaOrder.findMany({
                    where: { shopId, status: 'PENDING' },
                    orderBy: { updatedAt: 'desc' },
                    take: Math.ceil(limit / 4),
                    select: { id: true },
                });
                orderIds = rows2.map((r) => r.id);
            }
        }
        if (orderIds.length) {
            orderItemIds = await (0, _helpers_1.collectOrderItemIdsByStatus)({ shopId, orderIds, includeStatuses: ['PACKED'], max: limit });
        }
    }
    if (orderItemIds.length === 0)
        return server_1.NextResponse.json({ ok: true, message: 'No items to mark ready-to-ship' });
    const resp = await (0, _helpers_1.readyToShip)(shopId, orderItemIds);
    return server_1.NextResponse.json(resp);
}
