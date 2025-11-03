"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function POST(request, { params }) {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const { id: shopId } = await params;
    const body = (await request.json().catch(() => ({})));
    const { userId, roleAtShop } = body;
    if (!userId || !roleAtShop)
        return server_1.NextResponse.json({ error: 'userId and roleAtShop required' }, { status: 400 });
    // validate roleAtShop to match Prisma enum
    const allowed = new Set(['ATTENDANT', 'SUPERVISOR']);
    if (!allowed.has(roleAtShop))
        return server_1.NextResponse.json({ error: 'invalid roleAtShop' }, { status: 400 });
    const role = roleAtShop;
    // use upsert with the compound unique index (userId, shopId)
    const up = await prisma_1.prisma.userShop.upsert({
        where: { userId_shopId: { userId, shopId } },
        create: { userId, shopId, roleAtShop: role },
        update: { roleAtShop: role },
    });
    // return the created/updated assignment and basic user info
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    return server_1.NextResponse.json({ ok: true, assignment: up, user }, { status: 200 });
}
