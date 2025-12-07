"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const client_1 = require("@prisma/client");
const api_1 = require("@/lib/api");
exports.dynamic = 'force-dynamic';
// Next 16 context.params is a Promise in typed App Router handlers; accept both shapes.
async function POST(req, context) {
    const guard = await (0, api_1.requireRole)(['ADMIN']);
    if (!guard.ok)
        return guard.res;
    const body = await req.json().catch(() => ({}));
    const { amount = 0, reason = 'adjustment' } = body;
    try {
        const { userId } = 'params' in context && typeof context.params?.then === 'function'
            ? await context.params
            : context.params;
        const amt = Number(amount || 0);
        const bal = await prisma_1.prisma.balance.upsert({ where: { userId }, create: { userId, available: amt, pending: 0 }, update: { available: { increment: amt } } });
        await prisma_1.prisma.actionLog.create({ data: { actorId: guard.session?.user?.id ?? 'system', entity: 'Balance', entityId: userId, action: 'ADJUST', before: client_1.Prisma.JsonNull, after: bal } });
        return server_1.NextResponse.json({ ok: true, balance: bal });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed';
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
