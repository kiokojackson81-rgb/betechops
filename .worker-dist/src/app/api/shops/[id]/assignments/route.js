"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function GET(_, { params }) {
    const auth = await (0, api_1.requireRole)(['ADMIN', 'SUPERVISOR']);
    if (!auth.ok)
        return auth.res;
    const { id: shopId } = await params;
    const assignments = await prisma_1.prisma.userShop.findMany({ where: { shopId }, include: { user: true } });
    return server_1.NextResponse.json(assignments);
}
async function DELETE(request, { params }) {
    const auth = await (0, api_1.requireRole)(['ADMIN']);
    if (!auth.ok)
        return auth.res;
    const { id: shopId } = await params;
    const body = (await request.json().catch(() => ({})));
    const { userId } = body;
    if (!userId)
        return server_1.NextResponse.json({ error: 'userId required' }, { status: 400 });
    await prisma_1.prisma.userShop.deleteMany({ where: { shopId, userId } });
    return server_1.NextResponse.json({ ok: true });
}
