"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const client_1 = require("@prisma/client");
const jumia_1 = require("@/lib/jumia");
const scope_1 = require("@/lib/scope");
/**
 * Week window (Mon 00:00 → Sun 23:59) in Africa/Nairobi without adding deps.
 * We compute in UTC but align boundaries to Nairobi (UTC+3).
 */
function getThisWeekRangeNairobi() {
    const now = new Date();
    // Shift to Nairobi "local" by +3h
    const nairobiMs = now.getTime() + 3 * 60 * 60 * 1000;
    const nairobiNow = new Date(nairobiMs);
    // Find Monday of this week (0=Sun,1=Mon,...)
    const day = nairobiNow.getUTCDay();
    const diffToMonday = (day + 6) % 7; // Mon=1 → 0, Sun=0 → 6
    const start = new Date(Date.UTC(nairobiNow.getUTCFullYear(), nairobiNow.getUTCMonth(), nairobiNow.getUTCDate() - diffToMonday, 0, 0, 0, 0));
    // Convert boundaries back to UTC time by -3h
    const startUTC = new Date(start.getTime() - 3 * 60 * 60 * 1000);
    // End = start + 7 days
    const endUTC = new Date(startUTC.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { startUTC, endUTC };
}
async function GET() {
    var _a;
    try {
        const scope = await (0, scope_1.resolveShopScope)();
        const { startUTC, endUTC } = getThisWeekRangeNairobi();
        // Parallel simple counts
        const roles = [client_1.Role.ATTENDANT, client_1.Role.SUPERVISOR, client_1.Role.ADMIN];
        const shopWhere = scope.shopIds && scope.shopIds.length > 0 ? { id: { in: scope.shopIds } } : undefined;
        const orderWhere = scope.shopIds && scope.shopIds.length > 0 ? { shopId: { in: scope.shopIds } } : undefined;
        const userWhere = scope.shopIds && scope.shopIds.length > 0
            ? { role: { in: roles }, managedShops: { some: { id: { in: scope.shopIds } } } }
            : { role: { in: roles } };
        const [products, shops, attendants, orders] = await Promise.all([
            prisma_1.prisma.product.count(),
            prisma_1.prisma.shop.count({ where: shopWhere }),
            prisma_1.prisma.user.count({ where: userWhere }),
            prisma_1.prisma.order.count({ where: orderWhere }),
        ]);
        // Revenue this week: sum of paidAmount for orders created this week
        const revenueAgg = await prisma_1.prisma.order.aggregate({
            where: Object.assign({ createdAt: { gte: startUTC, lt: endUTC } }, (orderWhere || {})),
            _sum: { paidAmount: true },
        });
        const revenueThisWeek = (_a = revenueAgg._sum.paidAmount) !== null && _a !== void 0 ? _a : 0;
        // Buying this week:
        // Sum(Product.actualPrice * OrderItem.quantity) for items whose parent order was created this week
        const orderItems = await prisma_1.prisma.orderItem.findMany({
            where: { order: Object.assign({ createdAt: { gte: startUTC, lt: endUTC } }, (orderWhere || {})) },
            select: { quantity: true, product: { select: { lastBuyingPrice: true } } },
        });
        const buyingThisWeek = orderItems.reduce((sum, it) => {
            var _a, _b;
            const cost = ((_b = (_a = it.product) === null || _a === void 0 ? void 0 : _a.lastBuyingPrice) !== null && _b !== void 0 ? _b : 0) * it.quantity;
            return sum + cost;
        }, 0);
        // Profit (gross)
        const profitThisWeek = revenueThisWeek - buyingThisWeek;
        // Jumia-derived metrics (sales today, pending pricing, returns waiting pickup)
        const [salesTodayAgg, pendingPricingAgg, returnsWaitingPickupAgg] = await Promise.all([
            (0, jumia_1.getSalesToday)(),
            (0, jumia_1.getPendingPricingCount)(),
            (0, jumia_1.getReturnsWaitingPickup)(),
        ]);
        const salesToday = (salesTodayAgg && typeof salesTodayAgg.total === 'number') ? salesTodayAgg.total : 0;
        const pendingPricing = (pendingPricingAgg && typeof pendingPricingAgg.count === 'number') ? pendingPricingAgg.count : 0;
        const returnsWaitingPickup = (returnsWaitingPickupAgg && typeof returnsWaitingPickupAgg.count === 'number') ? returnsWaitingPickupAgg.count : 0;
        const payload = {
            products,
            shops,
            attendants,
            orders,
            revenueThisWeek,
            buyingThisWeek,
            profitThisWeek,
            returnsWaitingPickup,
            salesToday,
            pendingPricing,
        };
        return server_1.NextResponse.json(payload, { status: 200 });
    }
    catch (e) {
        console.error("summary error:", e);
        // Return a safe shape so dashboard remains functional even when summary build fails
        return server_1.NextResponse.json({
            products: 0,
            shops: 0,
            attendants: 0,
            orders: 0,
            revenueThisWeek: 0,
            buyingThisWeek: 0,
            profitThisWeek: 0,
            returnsWaitingPickup: 0,
            salesToday: 0,
            pendingPricing: 0,
            error: e instanceof Error ? e.message : String(e),
        }, { status: 200 });
    }
}
