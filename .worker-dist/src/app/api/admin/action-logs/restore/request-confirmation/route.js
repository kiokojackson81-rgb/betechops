"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const zod_1 = require("zod");
const RequestSchema = zod_1.z.object({ actionLogId: zod_1.z.string() });
function makeToken() {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
}
async function POST(req) {
    const authz = await (0, api_1.requireRole)("ADMIN");
    if (!authz.ok)
        return authz.res;
    let body;
    try {
        body = await req.json();
    }
    catch (e) {
        return server_1.NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    let parsed;
    try {
        parsed = RequestSchema.parse(body);
    }
    catch (err) {
        return server_1.NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    try {
        const { actionLogId } = parsed;
        const target = await prisma_1.prisma.actionLog.findUnique({ where: { id: actionLogId } });
        if (!target)
            return server_1.NextResponse.json({ error: "ActionLog not found" }, { status: 404 });
        if (target.action !== "WIPE_RECEIPTS")
            return server_1.NextResponse.json({ error: "Target is not a wipe" }, { status: 400 });
        const actorId = await (0, api_1.getActorId)();
        const now = new Date();
        // simple rate-limit: max 3 requests in last 10 minutes
        const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
        const recent = await prisma_1.prisma.actionLog.count({ where: { action: "REQUEST_RESTORE_CONFIRM", actorId: actorId || undefined, createdAt: { gte: tenMinsAgo } } });
        if (recent >= 3)
            return server_1.NextResponse.json({ error: "Too many confirmation requests. Try again later." }, { status: 429 });
        const token = makeToken();
        const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // token valid 10 minutes
        const created = await prisma_1.prisma.actionLog.create({ data: { actorId: actorId || "", entity: "MarketingDailyEntry", entityId: target.entityId, action: "REQUEST_RESTORE_CONFIRM", before: undefined, after: { token, originalWipeId: actionLogId, expiresAt, consumed: false } } });
        return server_1.NextResponse.json({ ok: true, token, expiresAt }, { status: 200 });
    }
    catch (err) {
        console.error(err);
        return server_1.NextResponse.json({ error: err instanceof Error ? err.message : "request failed" }, { status: 500 });
    }
}
