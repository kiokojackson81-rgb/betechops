"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
const zod_1 = require("zod");
async function POST(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const body = await req.json().catch(() => ({}));
    const schema = zod_1.z.object({
        scope: zod_1.z.enum(["sku", "category", "shop", "global"]),
        shopId: zod_1.z.string().optional().nullable(),
        sku: zod_1.z.string().optional().nullable(),
        category: zod_1.z.string().optional().nullable(),
        type: zod_1.z.enum(["percent_profit", "percent_gross", "flat_per_item"]),
        rateDecimal: zod_1.z.number().min(0),
        effectiveFrom: zod_1.z.coerce.date(),
        effectiveTo: zod_1.z.coerce.date().optional().nullable(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success)
        return (0, api_1.noStoreJson)({ error: parsed.error.flatten() }, { status: 400 });
    const actorId = await (0, api_1.getActorId)();
    const data = parsed.data;
    const created = await prisma_1.prisma.commissionRule.create({
        data: {
            scope: data.scope,
            shopId: data.scope === "shop" ? (data.shopId || null) : null,
            sku: data.scope === "sku" ? (data.sku || null) : null,
            category: data.scope === "category" ? (data.category || null) : null,
            type: data.type,
            rateDecimal: data.rateDecimal,
            effectiveFrom: data.effectiveFrom,
            effectiveTo: data.effectiveTo || null,
            createdBy: actorId || "unknown",
        },
    });
    await prisma_1.prisma.actionLog.create({ data: { actorId: actorId || "", entity: "CommissionRule", entityId: created.id, action: "CREATE", before: undefined, after: created } });
    return (0, api_1.noStoreJson)({ ok: true, rule: created }, { status: 201 });
}
