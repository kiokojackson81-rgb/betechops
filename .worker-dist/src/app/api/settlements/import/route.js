"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
const profitRecompute_1 = require("@/lib/profitRecompute");
const zod_1 = require("zod");
async function POST(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const Row = zod_1.z.object({
        shopId: zod_1.z.string(),
        orderId: zod_1.z.string().optional().nullable(),
        orderItemId: zod_1.z.string().optional().nullable(),
        kind: zod_1.z.enum(["item_price", "commission", "shipping_fee", "refund", "penalty"]).or(zod_1.z.string()),
        amount: zod_1.z.number(),
        ref: zod_1.z.string().optional().nullable(),
        postedAt: zod_1.z.string(),
    });
    const body = await req.json().catch(() => []);
    const rowsParse = zod_1.z.array(Row).safeParse(body);
    if (!rowsParse.success || rowsParse.data.length === 0)
        return (0, api_1.noStoreJson)({ error: "Invalid rows" }, { status: 400 });
    const rows = rowsParse.data;
    const actorId = await (0, api_1.getActorId)();
    let inserted = 0;
    let minAt = null;
    let maxAt = null;
    const shops = new Set();
    for (const r of rows) {
        shops.add(r.shopId);
        const postedAt = new Date(r.postedAt);
        if (!minAt || postedAt < minAt)
            minAt = postedAt;
        if (!maxAt || postedAt > maxAt)
            maxAt = postedAt;
        const row = await prisma_1.prisma.settlementRow.create({
            data: {
                shopId: r.shopId,
                orderId: r.orderId || null,
                orderItemId: r.orderItemId || null,
                kind: String(r.kind),
                amount: Number(r.amount),
                ref: r.ref || null,
                postedAt,
                raw: r,
            },
        });
        inserted++;
        if (actorId)
            await prisma_1.prisma.actionLog.create({ data: { actorId, entity: "SettlementRow", entityId: row.id, action: "IMPORT", before: undefined, after: row } });
    }
    // Trigger recompute per shop for affected window
    const from = minAt || new Date();
    const to = maxAt || new Date();
    const results = {};
    for (const shopId of shops) {
        const { snapshots } = await (0, profitRecompute_1.recomputeProfit)({ from, to, shopId, actorId });
        results[shopId] = snapshots;
    }
    return (0, api_1.noStoreJson)({ ok: true, inserted, recompute: { from, to, results } });
}
