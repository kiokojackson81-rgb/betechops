"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
async function POST(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const text = await req.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2)
        return (0, api_1.noStoreJson)({ error: "CSV required (headers + rows)" }, { status: 400 });
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idxSku = header.indexOf("sku");
    const idxShop = header.indexOf("shopid");
    const idxCost = header.indexOf("cost");
    const idxFrom = header.indexOf("effectivefrom");
    const idxTo = header.indexOf("effectiveto");
    if (idxSku < 0 || idxCost < 0 || idxFrom < 0)
        return (0, api_1.noStoreJson)({ error: "headers must include sku,cost,effectiveFrom" }, { status: 400 });
    const actorId = await (0, api_1.getActorId)();
    const created = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const sku = cols[idxSku];
        const shopId = idxShop >= 0 ? (cols[idxShop] || null) : null;
        const cost = Number(cols[idxCost]);
        const effectiveFrom = new Date(cols[idxFrom]);
        const effectiveTo = idxTo >= 0 && cols[idxTo] ? new Date(cols[idxTo]) : null;
        if (!sku || isNaN(cost) || isNaN(effectiveFrom.getTime()))
            continue;
        const row = await prisma_1.prisma.costCatalog.create({ data: { sku, shopId, cost, effectiveFrom, effectiveTo } });
        created.push(i);
        if (actorId)
            await prisma_1.prisma.actionLog.create({ data: { actorId, entity: "CostCatalog", entityId: row.id, action: "IMPORT", before: undefined, after: row } });
    }
    return (0, api_1.noStoreJson)({ ok: true, created: created.length });
}
