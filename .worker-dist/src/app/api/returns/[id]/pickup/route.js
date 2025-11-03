"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
const scope_1 = require("@/lib/scope");
const returns_1 = require("@/lib/returns");
async function POST(req, context) {
    const { id } = await context.params;
    const authz = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!authz.ok)
        return authz.res;
    const body = (await req.json().catch(() => ({})));
    const { scheduledAt, carrier, tracking, assignedTo, notes } = body;
    if (!scheduledAt || !carrier || !assignedTo)
        return (0, api_1.noStoreJson)({ error: "scheduledAt, carrier, assignedTo required" }, { status: 400 });
    const ret = await prisma_1.prisma.returnCase.findUnique({ where: { id } });
    if (!ret)
        return (0, api_1.noStoreJson)({ error: "Return not found" }, { status: 404 });
    const scope = await (0, scope_1.resolveShopScope)();
    if (String(scope.role) !== "ADMIN" && scope.shopIds && !scope.shopIds.includes(ret.shopId)) {
        return (0, api_1.noStoreJson)({ error: "Forbidden" }, { status: 403 });
    }
    const can = (0, returns_1.guardTransition)(ret.status, "pickup_scheduled", { role: String(scope.role) });
    if (!can.ok)
        return (0, api_1.noStoreJson)({ error: can.reason }, { status: 400 });
    const before = ret;
    const pickup = await prisma_1.prisma.returnPickup.create({
        data: { returnCaseId: id, scheduledAt: new Date(scheduledAt), carrier, tracking: tracking || null, assignedTo, notes: notes || null },
    });
    const updated = await prisma_1.prisma.returnCase.update({ where: { id }, data: { status: "pickup_scheduled" } });
    await prisma_1.prisma.actionLog.create({ data: { actorId: assignedTo, entity: "ReturnCase", entityId: id, action: "PICKUP_SCHEDULED", before, after: Object.assign(Object.assign({}, updated), { pickupId: pickup.id }) } });
    return (0, api_1.noStoreJson)({ ok: true, id, status: updated.status, pickupId: pickup.id });
}
