"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
const returns_1 = require("@/lib/returns");
const config_1 = require("@/lib/config");
async function PATCH(req, context) {
    const { id } = await context.params;
    const authz = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!authz.ok)
        return authz.res;
    const body = (await req.json().catch(() => ({})));
    const { to, category, evidence } = body;
    if (!to)
        return (0, api_1.noStoreJson)({ error: "to required" }, { status: 400 });
    const ret = await prisma_1.prisma.returnCase.findUnique({ where: { id }, include: { evidence: true } });
    if (!ret)
        return (0, api_1.noStoreJson)({ error: "Return not found" }, { status: 404 });
    const policy = await (0, config_1.getEvidencePolicy)();
    const evidenceArr = (evidence || ret.evidence);
    const can = (0, returns_1.guardTransition)(ret.status, String(to), {
        role: String(authz.role),
        evidence: evidenceArr,
        category: category || undefined,
        policy,
        received: ret.status === "received" || String(to) === "resolved",
    });
    if (!can.ok)
        return (0, api_1.noStoreJson)({ error: can.reason }, { status: 400 });
    const before = ret;
    const updated = await prisma_1.prisma.returnCase.update({ where: { id }, data: { status: String(to) } });
    const actorId = (authz.session?.user?.id) || "";
    await prisma_1.prisma.actionLog.create({ data: { actorId, entity: "ReturnCase", entityId: id, action: "STATE", before, after: updated } });
    return (0, api_1.noStoreJson)({ ok: true, id, status: updated.status });
}
