"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const onlineOps_1 = require("@/lib/onlineOps");
exports.dynamic = "force-dynamic";
const normalizeName = (value) => value.trim().toLowerCase();
async function POST(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    let payload = null;
    try {
        payload = (await req.json());
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    if (!payload?.orderItemId) {
        return server_1.NextResponse.json({ error: "orderItemId is required" }, { status: 400 });
    }
    const buyingPrice = Number(payload.buyingPrice);
    if (!Number.isFinite(buyingPrice) || buyingPrice <= 0) {
        return server_1.NextResponse.json({ error: "buyingPrice must be a positive number" }, { status: 400 });
    }
    const order = await prisma_1.prisma.marketplaceOrder.findFirst({
        where: { orderItemId: payload.orderItemId },
        include: { account: true },
    });
    if (!order) {
        return server_1.NextResponse.json({ error: "Order item not found" }, { status: 404 });
    }
    const { accountIds } = await (0, onlineOps_1.getMarketplaceAssignmentsForUser)(auth.user.id);
    const hasAccess = accountIds.includes(order.accountId);
    if (!hasAccess && auth.role !== "ADMIN") {
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rounded = Math.round(buyingPrice);
    const sellingPrice = Number(order.sellingPrice ?? 0);
    const fee = Number(order.sellerFee ?? 0);
    const shipping = Number(order.shippingFee ?? 0);
    const profit = sellingPrice - fee - shipping - rounded;
    await prisma_1.prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: {
            buyingPrice: rounded,
            profit,
            pricedById: auth.user.id,
            pricedAt: new Date(),
        },
    });
    // Record a profit recognition event
    try {
        await prisma_1.prisma.profitEvent.create({
            data: {
                marketplaceOrderId: order.id,
                type: "RECOGNISE",
                amount: profit,
            },
        });
    }
    catch (err) {
        console.warn("Failed to create ProfitEvent for priced order", err);
    }
    const normalizedName = normalizeName(order.productName);
    await prisma_1.prisma.marketplacePricingTemplate.upsert({
        where: {
            platform_normalizedProductName_sellingPrice: {
                platform: order.platform,
                normalizedProductName: normalizedName,
                sellingPrice: sellingPrice,
            },
        },
        create: {
            platform: order.platform,
            normalizedProductName: normalizedName,
            sellingPrice,
            defaultBuyingPrice: rounded,
            updatedById: auth.user.id,
        },
        update: {
            defaultBuyingPrice: rounded,
            updatedById: auth.user.id,
            updatedAt: new Date(),
        },
    });
    return server_1.NextResponse.json({
        ok: true,
        orderId: order.orderId,
        orderItemId: order.orderItemId,
        profit,
        sellingPrice,
        buyingPrice: rounded,
    });
}
