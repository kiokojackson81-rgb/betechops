"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeProfit = recomputeProfit;
const prisma_1 = require("@/lib/prisma");
const profit_1 = require("@/lib/profit");
async function recomputeProfit({ from, to, shopId, actorId }) {
    var _a, _b, _c;
    const rows = await prisma_1.prisma.settlementRow.findMany({
        where: Object.assign(Object.assign({ postedAt: { gte: from, lte: to } }, (shopId ? { shopId } : {})), { orderItemId: { not: null } }),
    });
    if (!rows.length)
        return { snapshots: 0 };
    const byItem = new Map();
    for (const r of rows) {
        const id = r.orderItemId;
        if (!byItem.has(id))
            byItem.set(id, []);
        byItem.get(id).push(r);
    }
    const itemIds = Array.from(byItem.keys());
    const items = await prisma_1.prisma.orderItem.findMany({
        where: { id: { in: itemIds } },
        include: { product: { select: { sku: true, category: true } }, order: { select: { shopId: true, createdAt: true } } },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const overrides = await prisma_1.prisma.orderCost.findMany({ where: { orderItemId: { in: itemIds } }, orderBy: { createdAt: "desc" } });
    const latestOverride = new Map();
    for (const oc of overrides)
        if (!latestOverride.has(oc.orderItemId))
            latestOverride.set(oc.orderItemId, oc);
    let snapshots = 0;
    const now = new Date();
    for (const orderItemId of itemIds) {
        const info = itemMap.get(orderItemId);
        if (!info)
            continue;
        const sku = (_a = info.product) === null || _a === void 0 ? void 0 : _a.sku;
        const qty = Number(info.quantity || 0);
        const sellPrice = Number(info.sellingPrice || 0);
        const refDate = new Date(((_b = info.order) === null || _b === void 0 ? void 0 : _b.createdAt) || now);
        const shop = ((_c = info.order) === null || _c === void 0 ? void 0 : _c.shopId) || null;
        const rowsFor = (byItem.get(orderItemId) || []);
        const sumBy = (k) => rowsFor
            .filter((r) => (r.kind || "").toLowerCase() === k)
            .reduce((t, r) => { var _a; return t + Number((_a = r.amount) !== null && _a !== void 0 ? _a : 0); }, 0);
        const commission = sumBy("commission");
        const penalty = sumBy("penalty");
        const shipping_fee = sumBy("shipping_fee");
        const refund = sumBy("refund");
        let unitCost = null;
        const oc = latestOverride.get(orderItemId);
        if (oc)
            unitCost = Number(oc.unitCost || 0);
        if (unitCost == null) {
            const catShop = await prisma_1.prisma.costCatalog.findFirst({
                where: { sku, shopId: shop, effectiveFrom: { lte: refDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: refDate } }] },
                orderBy: { effectiveFrom: "desc" },
            });
            if (catShop)
                unitCost = Number(catShop.cost || 0);
            if (unitCost == null) {
                const catGlobal = await prisma_1.prisma.costCatalog.findFirst({
                    where: { sku, shopId: null, effectiveFrom: { lte: refDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: refDate } }] },
                    orderBy: { effectiveFrom: "desc" },
                });
                if (catGlobal)
                    unitCost = Number(catGlobal.cost || 0);
            }
        }
        if (unitCost == null)
            unitCost = 0;
        const p = (0, profit_1.computeProfit)({ sellPrice: sellPrice, qty, unitCost, settlement: { commission: [commission], penalty: [penalty], shipping_fee: [shipping_fee], refund: [refund] } });
        const snap = await prisma_1.prisma.profitSnapshot.create({ data: { orderItemId, revenue: p.revenue, fees: p.fees, shipping: p.shipping, refunds: p.refunds, unitCost: p.unitCost, qty: p.qty, profit: p.profit } });
        snapshots++;
        if (actorId)
            await prisma_1.prisma.actionLog.create({ data: { actorId, entity: "ProfitSnapshot", entityId: snap.id, action: "RECOMPUTE", before: undefined, after: snap } });
    }
    return { snapshots };
}
