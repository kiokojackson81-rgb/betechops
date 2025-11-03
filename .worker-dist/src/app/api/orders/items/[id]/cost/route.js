"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
async function PATCH(req, context) {
    const { id } = await context.params;
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    const body = (await req.json().catch(() => ({})));
    const { unitCost } = body;
    if (unitCost == null)
        return (0, api_1.noStoreJson)({ error: "unitCost required" }, { status: 400 });
    const row = await prisma_1.prisma.orderCost.create({ data: { orderItemId: id, unitCost: Number(unitCost), costSource: "override" } });
    const actorId = await (0, api_1.getActorId)();
    if (actorId)
        await prisma_1.prisma.actionLog.create({ data: { actorId, entity: "OrderCost", entityId: row.id, action: "OVERRIDE", before: undefined, after: row } });
    return (0, api_1.noStoreJson)({ ok: true, id });
}
