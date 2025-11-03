"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeCommissions = recomputeCommissions;
const prisma_1 = require("@/lib/prisma");
const commissions_1 = require("@/lib/commissions");
async function recomputeCommissions(input) {
    var _a, _b, _c;
    const { shopId, window } = input;
    const from = new Date(window.from);
    const to = new Date(window.to);
    // Fetch relevant snapshots with orderItem->product and order relation
    const snapshots = await prisma_1.prisma.profitSnapshot.findMany({
        where: {
            computedAt: { gte: from, lte: to },
            orderItem: shopId ? { order: { shopId } } : undefined,
        },
        include: {
            orderItem: {
                include: {
                    product: true,
                    order: true,
                },
            },
        },
    });
    // Collect shopIds present for rule pre-filtering
    const shopIds = Array.from(new Set(snapshots.map(s => { var _a, _b; return (_b = (_a = s.orderItem) === null || _a === void 0 ? void 0 : _a.order) === null || _b === void 0 ? void 0 : _b.shopId; }).filter(Boolean)));
    // Fetch CommissionRules overlapping the window; we'll filter by scope in-memory
    const rules = await prisma_1.prisma.commissionRule.findMany({
        where: {
            AND: [
                { effectiveFrom: { lte: to } },
                { OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }] },
            ],
            // Narrow by shopId for shop-scoped rules if available
            OR: [
                { scope: "global" },
                { scope: "sku" },
                { scope: "category" },
                shopIds.length ? { AND: [{ scope: "shop" }, { shopId: { in: shopIds } }] } : { scope: "shop" },
            ],
        },
    });
    // Remove existing earnings in the window and scope to avoid duplicates
    const delRes = await prisma_1.prisma.commissionEarning.deleteMany({
        where: {
            createdAt: { gte: from, lte: to },
            orderItem: shopId ? { order: { shopId } } : undefined,
        },
    });
    const earnings = [];
    for (const s of snapshots) {
        const order = (_a = s.orderItem) === null || _a === void 0 ? void 0 : _a.order;
        const product = (_b = s.orderItem) === null || _b === void 0 ? void 0 : _b.product;
        const staffId = order === null || order === void 0 ? void 0 : order.attendantId;
        if (!order || !product || !staffId)
            continue; // cannot attribute without attendant
        const basis = {
            revenue: Number(s.revenue),
            profit: Number(s.profit),
            qty: Number(s.qty || 1),
            sku: String(product.sku),
            category: product.category || null,
            shopId: String(order.shopId),
            at: new Date(s.computedAt),
        };
        const rule = (0, commissions_1.pickRule)(rules, basis);
        if (!rule)
            continue;
        const { amount, detail } = (0, commissions_1.computeCommission)(rule, basis);
        if (!amount)
            continue;
        const basisKind = rule.type === "percent_profit" ? "profit" : rule.type === "percent_gross" ? "gross" : "flat";
        earnings.push({
            staffId,
            orderItemId: s.orderItemId,
            basis: basisKind,
            qty: basis.qty,
            amount: Number(amount),
            status: "pending",
            calcDetail: Object.assign(Object.assign({}, detail), { at: basis.at, shopId: basis.shopId, sku: basis.sku }),
            createdAt: new Date(),
        });
    }
    // Handle return reversals within window: create negative entries for impacted items
    const adjustments = await prisma_1.prisma.returnAdjustment.findMany({
        where: {
            createdAt: { gte: from, lte: to },
            returnCase: shopId ? { shopId } : undefined,
        },
        include: {
            orderItem: { include: { order: true } },
        },
    });
    // Map to total computed per orderItem from this batch
    const totalsByItem = new Map();
    for (const e of earnings) {
        totalsByItem.set(e.orderItemId, (totalsByItem.get(e.orderItemId) || 0) + Number(e.amount));
    }
    let reversed = 0;
    for (const adj of adjustments) {
        if (adj.commissionImpact !== "reverse")
            continue;
        const itemId = adj.orderItemId;
        const order = (_c = adj.orderItem) === null || _c === void 0 ? void 0 : _c.order;
        const staffId = order === null || order === void 0 ? void 0 : order.attendantId;
        if (!staffId)
            continue;
        const total = totalsByItem.get(itemId) || 0;
        if (!total)
            continue;
        earnings.push({
            staffId,
            orderItemId: itemId,
            basis: "profit",
            qty: 0,
            amount: -Math.abs(total),
            status: "reversed",
            calcDetail: { reason: "return_reverse", adjustmentId: adj.id },
            createdAt: new Date(),
        });
        reversed++;
    }
    let created = 0;
    if (earnings.length) {
        const res = await prisma_1.prisma.commissionEarning.createMany({ data: earnings });
        created = res.count || 0;
    }
    return { deleted: delRes.count || 0, created, reversed };
}
