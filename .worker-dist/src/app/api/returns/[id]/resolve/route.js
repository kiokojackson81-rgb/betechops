"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
const returns_1 = require("@/lib/returns");
async function PATCH(req, context) {
    const { id } = await context.params;
    const authz = await (0, api_1.requireRole)(["ADMIN"]);
    if (!authz.ok)
        return authz.res;
    const body = (await req.json().catch(() => ({})));
    const { resolution, orderItemId, amount, commissionImpact, notes } = body;
    if (!resolution)
        return (0, api_1.noStoreJson)({ error: "resolution required" }, { status: 400 });
    const ret = await prisma_1.prisma.returnCase.findUnique({ where: { id } });
    if (!ret)
        return (0, api_1.noStoreJson)({ error: "Return not found" }, { status: 404 });
    if (ret.status !== "received")
        return (0, api_1.noStoreJson)({ error: "Cannot resolve before received" }, { status: 400 });
    const can = (0, returns_1.guardTransition)("received", "resolved", { role: String(authz.role), received: true });
    if (!can.ok)
        return (0, api_1.noStoreJson)({ error: can.reason }, { status: 400 });
    const before = ret;
    let adjId;
    if (orderItemId && amount) {
        const adj = await prisma_1.prisma.returnAdjustment.create({
            data: { returnCaseId: id, orderItemId, amount: Number(amount), commissionImpact: commissionImpact || "reverse", notes: notes || null },
        });
        adjId = adj.id;
    }
    const updated = await prisma_1.prisma.returnCase.update({ where: { id }, data: { status: "resolved", resolution } });
    const actorId = (authz.session?.user?.id) || '';
    await prisma_1.prisma.actionLog.create({ data: { actorId, entity: "ReturnCase", entityId: id, action: "RESOLVE", before, after: { ...updated, adjustmentId: adjId } } });
    return (0, api_1.noStoreJson)({ ok: true, id, status: updated.status, adjustmentId: adjId });
}
