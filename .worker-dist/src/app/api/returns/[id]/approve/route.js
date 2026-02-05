"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
const scope_1 = require("@/lib/scope");
const returns_1 = require("@/lib/returns");
// session is provided by requireRole; no need to import auth directly
const client_1 = require("@prisma/client");
async function PATCH(_req, context) {
    const { id } = await context.params;
    const authz = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!authz.ok)
        return authz.res;
    const session = authz.session;
    const email = session?.user?.email?.toLowerCase() || "";
    const actor = email ? await prisma_1.prisma.user.findUnique({ where: { email }, select: { id: true, role: true } }) : null;
    if (!actor)
        return (0, api_1.noStoreJson)({ error: "Actor not found" }, { status: 401 });
    const ret = await prisma_1.prisma.returnCase.findUnique({ where: { id }, include: { evidence: true } });
    if (!ret)
        return (0, api_1.noStoreJson)({ error: "Return not found" }, { status: 404 });
    // Scope check for non-admins
    const scope = await (0, scope_1.resolveShopScope)();
    if (scope.role !== client_1.Role.ADMIN && scope.shopIds && !scope.shopIds.includes(ret.shopId)) {
        return (0, api_1.noStoreJson)({ error: "Forbidden" }, { status: 403 });
    }
    const can = (0, returns_1.guardTransition)(ret.status, "approved", { role: actor.role });
    if (!can.ok)
        return (0, api_1.noStoreJson)({ error: can.reason }, { status: 400 });
    const before = ret;
    const updated = await prisma_1.prisma.returnCase.update({ where: { id: ret.id }, data: { status: "approved", approvedBy: actor.id } });
    await prisma_1.prisma.actionLog.create({ data: { actorId: actor.id, entity: "ReturnCase", entityId: ret.id, action: "APPROVE", before, after: updated } });
    return (0, api_1.noStoreJson)({ ok: true, id: ret.id, status: updated.status });
}
