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
    const includeLabels = !!body.includeLabels;
    let orderItemIds = Array.isArray(body.orderItemIds) ? body.orderItemIds.filter(Boolean) : [];
    if (orderItemIds.length === 0) {
        let orderIds = Array.isArray(body.orderIds) ? body.orderIds.filter(Boolean) : [];
        if (orderIds.length === 0) {
            // Prefer orders READY_TO_SHIP for labels, but also allow SHIPPED/DELIVERED
            const rows = await prisma_1.prisma.jumiaOrder.findMany({
                where: { shopId, status: { in: ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED'] } },
                orderBy: { updatedAt: 'desc' },
                take: Math.ceil(limit / 4),
                select: { id: true },
            });
            orderIds = rows.map((r) => r.id);
            if (orderIds.length === 0) {
                // fallback to PACKED
                const rows2 = await prisma_1.prisma.jumiaOrder.findMany({
                    where: { shopId, status: 'PACKED' },
                    orderBy: { updatedAt: 'desc' },
                    take: Math.ceil(limit / 4),
                    select: { id: true },
                });
                orderIds = rows2.map((r) => r.id);
            }
        }
        if (orderIds.length) {
            orderItemIds = await (0, _helpers_1.collectOrderItemIdsByStatus)({ shopId, orderIds, includeStatuses: ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED'], max: limit });
            if (orderItemIds.length === 0) {
                // some partners allow printing when PACKED as well
                orderItemIds = await (0, _helpers_1.collectOrderItemIdsByStatus)({ shopId, orderIds, includeStatuses: ['PACKED'], max: limit });
            }
        }
    }
    if (orderItemIds.length === 0)
        return server_1.NextResponse.json({ ok: true, message: 'No items eligible for label printing' });
    const resp = await (0, _helpers_1.printLabels)(shopId, orderItemIds, includeLabels);
    return server_1.NextResponse.json(resp);
}
