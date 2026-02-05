"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function GET(request) {
    const auth = await (0, api_1.requireRole)(['ADMIN']);
    if (!auth.ok)
        return auth.res;
    const url = new URL(request.url);
    const shopId = url.searchParams.get('shopId') || undefined;
    const day = url.searchParams.get('day') || undefined;
    const where = {};
    if (shopId)
        where.shopId = shopId;
    if (day)
        where.day = new Date(day);
    const rows = await prisma_1.prisma.reconciliation.findMany({ where, include: { shop: true } });
    const discrepancies = await prisma_1.prisma.discrepancy.findMany({ where: shopId ? { shopId } : undefined });
    return server_1.NextResponse.json({ rows, discrepancies });
}
