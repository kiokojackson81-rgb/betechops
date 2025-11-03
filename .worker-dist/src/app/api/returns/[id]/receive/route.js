"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
const returns_1 = require("@/lib/returns");
async function PATCH(_req, context) {
    var _a, _b;
    const { id } = await context.params;
    const authz = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!authz.ok)
        return authz.res;
    const ret = await prisma_1.prisma.returnCase.findUnique({ where: { id } });
    if (!ret)
        return (0, api_1.noStoreJson)({ error: "Return not found" }, { status: 404 });
    const actorId = ((_b = (_a = authz.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) || '';
    const can = (0, returns_1.guardTransition)(ret.status, "received", { role: String(authz.role) });
    if (!can.ok)
        return (0, api_1.noStoreJson)({ error: can.reason }, { status: 400 });
    const before = ret;
    const updated = await prisma_1.prisma.returnCase.update({ where: { id }, data: { status: "received" } });
    await prisma_1.prisma.actionLog.create({ data: { actorId, entity: "ReturnCase", entityId: id, action: "RECEIVED", before, after: updated } });
    return (0, api_1.noStoreJson)({ ok: true, id, status: updated.status });
}
