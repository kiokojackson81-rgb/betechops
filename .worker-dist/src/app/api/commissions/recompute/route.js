"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const zod_1 = require("zod");
const commissionRecompute_1 = require("@/lib/commissionRecompute");
const prisma_1 = require("@/lib/prisma");
async function POST(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const schema = zod_1.z.object({
        shopId: zod_1.z.string().optional().nullable(),
        from: zod_1.z.coerce.date(),
        to: zod_1.z.coerce.date(),
    });
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success)
        return (0, api_1.noStoreJson)({ error: parsed.error.flatten() }, { status: 400 });
    const { shopId, from, to } = parsed.data;
    const res = await (0, commissionRecompute_1.recomputeCommissions)({ shopId: shopId || undefined, window: { from, to } });
    const actorId = await (0, api_1.getActorId)();
    await prisma_1.prisma.actionLog.create({ data: { actorId: actorId || "", entity: "CommissionEarning", entityId: "batch", action: "RECOMPUTE", before: undefined, after: res } });
    return (0, api_1.noStoreJson)(Object.assign({ ok: true }, res));
}
