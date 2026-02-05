"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const onlineOps_1 = require("@/lib/onlineOps");
exports.dynamic = "force-dynamic";
const normalizeName = (value) => value.trim().toLowerCase();
async function GET(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const { accountIds } = await (0, onlineOps_1.getMarketplaceAssignmentsForUser)(auth.user.id);
    if (!accountIds.length) {
        return server_1.NextResponse.json({ orders: [] });
    }
    const url = new URL(req.url);
    const take = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
    const statusFilter = url.searchParams.get("status") ?? "all";
    const whereBase = {
        accountId: { in: accountIds },
        buyingPrice: null,
    };
    if (statusFilter && statusFilter !== "all") {
        const sf = String(statusFilter).toUpperCase();
        whereBase.status = sf;
    }
    const orders = await prisma_1.prisma.marketplaceOrder.findMany({
        where: whereBase,
        include: { account: true },
        orderBy: { orderedAt: "desc" },
        take,
    });
    if (!orders.length)
        return server_1.NextResponse.json({ orders: [] });
    const templateKeys = Array.from(new Set(orders.map((order) => `${order.platform}:${normalizeName(order.productName)}:${Number(order.sellingPrice ?? 0)}`)));
    const templates = templateKeys.length
        ? await prisma_1.prisma.marketplacePricingTemplate.findMany({
            where: {
                OR: templateKeys.map((key) => {
                    const [platform, name, price] = key.split(":");
                    return {
                        platform: platform,
                        normalizedProductName: name,
                        sellingPrice: Number(price),
                    };
                }),
            },
        })
        : [];
    const templateMap = new Map();
    templates.forEach((template) => {
        const mapKey = `${template.platform}:${template.normalizedProductName}:${Number(template.sellingPrice ?? 0)}`;
        templateMap.set(mapKey, Number(template.defaultBuyingPrice ?? 0));
    });
    return server_1.NextResponse.json({
        orders: orders.map((order) => {
            const key = `${order.platform}:${normalizeName(order.productName)}:${Number(order.sellingPrice ?? 0)}`;
            return {
                id: order.id,
                accountId: order.accountId,
                accountName: order.account.displayName,
                platform: order.platform,
                orderId: order.orderId,
                orderItemId: order.orderItemId,
                status: order.status,
                orderedAt: order.orderedAt.toISOString(),
                productName: order.productName,
                productUrl: order.productUrl,
                sellingPrice: Number(order.sellingPrice ?? 0),
                currency: order.currency,
                suggestedBuyingPrice: templateMap.get(key) ?? null,
                // Extract fees from stored raw payload when available to show in UI
                sellerFee: Number(order.sellerFee ?? 0),
                shippingFee: Number(order.shippingFee ?? 0),
            };
        }),
    });
}
