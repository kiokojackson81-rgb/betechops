"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
exports.dynamic = "force-dynamic";
function requireAdmin(session) {
    if (!session || !session.user)
        return false;
    const role = session.user.role ?? null;
    return role === "ADMIN" || role === "SUPERVISOR";
}
async function GET(req) {
    const url = new URL(req.url);
    const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
    if (!requireAdmin(session)) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const attendantId = url.searchParams.get("attendantId");
    if (!attendantId)
        return server_1.NextResponse.json({ error: "attendantId required" }, { status: 400 });
    // Use current trading period bounds to scope receipts
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const start = period.start;
    const end = period.end;
    // Find receipts (order items) for attendant where buying price is missing or zero
    // and that fall within the trading period.
    const receipts = await prisma_1.prisma.order.findMany({
        where: {
            attendantId: attendantId,
            createdAt: { gte: start, lte: end },
        },
        select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            totalAmount: true,
            items: {
                select: {
                    id: true,
                    productId: true,
                    quantity: true,
                    sellingPrice: true,
                    orderCosts: { select: { unitCost: true } },
                    profitSnapshots: { select: { unitCost: true } },
                },
            },
        },
    });
    // Filter receipts that have at least one orderItem lacking a buyingPrice
    const missing = receipts
        .map((r) => ({
        id: r.id,
        orderNumber: r.orderNumber,
        createdAt: r.createdAt,
        sellingTotal: r.totalAmount,
        items: r.items.filter((it) => {
            const hasCost = (it.orderCosts && it.orderCosts.length > 0) || (it.profitSnapshots && it.profitSnapshots.length > 0);
            return !hasCost;
        }),
    }))
        .filter((r) => (r.items?.length ?? 0) > 0);
    return server_1.NextResponse.json({ period: period.label ?? "", attendantId, missing });
}
