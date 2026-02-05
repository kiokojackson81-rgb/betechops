"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function GET(req) {
    const authz = await (0, api_1.requireRole)("ADMIN");
    if (!authz.ok)
        return authz.res;
    try {
        const url = new URL(req.url);
        const wipeId = url.searchParams.get("wipeId");
        if (!wipeId)
            return server_1.NextResponse.json({ error: "wipeId required" }, { status: 400 });
        const logs = await prisma_1.prisma.actionLog.findMany({ where: { action: "RESTORE_RECEIPTS" }, orderBy: { createdAt: 'desc' }, take: 200 });
        const matching = logs.filter((l) => (l.after || {}).originalWipeId === wipeId).map((l) => ({ id: l.id, createdAt: l.createdAt, actorId: l.actorId, entityId: l.entityId, after: l.after }));
        return server_1.NextResponse.json({ ok: true, restores: matching }, { status: 200 });
    }
    catch (err) {
        console.error(err);
        return server_1.NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 });
    }
}
