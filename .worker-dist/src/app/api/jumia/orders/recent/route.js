"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function GET(req) {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const shopId = (url.searchParams.get('shopId') || '').trim();
    if (!shopId)
        return server_1.NextResponse.json({ error: 'shopId required' }, { status: 400 });
    const row = await prisma_1.prisma.jumiaOrder.findFirst({
        where: { shopId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
    }).catch(() => null);
    if (!row)
        return server_1.NextResponse.json({ orderId: null });
    return server_1.NextResponse.json({ orderId: row.id });
}
