"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const shops_1 = require("@/lib/rbac/shops");
const api_1 = require("@/lib/api");
async function POST(request, { params }) {
    const { productId } = await params;
    const body = (await request.json().catch(() => ({})));
    const { shopId, price, source = 'MANUAL' } = body;
    if (!shopId || price == null)
        return server_1.NextResponse.json({ error: 'shopId and price required' }, { status: 400 });
    const access = await (0, shops_1.requireShopAccess)({ shopId, minRole: 'SUPERVISOR' });
    if (!access.ok)
        return server_1.NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const actorId = await (0, api_1.getActorId)();
    const pc = await prisma_1.prisma.productCost.create({ data: { productId, price: price?.toString() ?? '0', source: String(source ?? 'MANUAL'), byUserId: actorId } });
    return server_1.NextResponse.json(pc, { status: 201 });
}
