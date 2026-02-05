"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const profitRecompute_1 = require("@/lib/profitRecompute");
const zod_1 = require("zod");
async function POST(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    const body = await req.json().catch(() => ({}));
    const schema = zod_1.z.object({ from: zod_1.z.string().optional(), to: zod_1.z.string().optional(), shopId: zod_1.z.string().nullable().optional() });
    const parsed = schema.safeParse(body);
    if (!parsed.success)
        return (0, api_1.noStoreJson)({ error: parsed.error.flatten() }, { status: 400 });
    const now = new Date();
    const fromAt = parsed.data.from ? new Date(parsed.data.from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const toAt = parsed.data.to ? new Date(parsed.data.to) : now;
    if (isNaN(fromAt.getTime()) || isNaN(toAt.getTime()))
        return (0, api_1.noStoreJson)({ error: "invalid from/to" }, { status: 400 });
    const actorId = await (0, api_1.getActorId)();
    const { snapshots } = await (0, profitRecompute_1.recomputeProfit)({ from: fromAt, to: toAt, shopId: parsed.data.shopId || undefined, actorId });
    return (0, api_1.noStoreJson)({ ok: true, window: { from: fromAt.toISOString(), to: toAt.toISOString() }, shopId: parsed.data.shopId || null, snapshots });
}
