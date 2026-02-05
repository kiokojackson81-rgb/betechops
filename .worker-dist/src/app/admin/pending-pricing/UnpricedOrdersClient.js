"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UnpricedOrdersClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const UnpricedOrdersCard_1 = __importDefault(require("@/app/attendant/jumia-ops/UnpricedOrdersCard"));
async function UnpricedOrdersClient({ period }) {
    // Server-side: fetch unpriced marketplace orders so admin users don't need attendant session
    const rows = await prisma_1.prisma.marketplaceOrder.findMany({
        where: {
            platform: client_1.Platform.JUMIA,
            buyingPrice: null,
            orderedAt: {
                gte: period.start,
                lte: period.end,
            },
        },
        include: { account: true },
        orderBy: { orderedAt: "desc" },
    });
    const orders = rows.map((order) => ({
        id: order.id,
        accountId: order.accountId,
        accountName: order.account?.displayName ?? "",
        platform: order.platform,
        orderId: order.orderId,
        orderItemId: order.orderItemId,
        status: order.status,
        orderedAt: order.orderedAt?.toISOString(),
        productName: order.productName,
        productUrl: order.productUrl,
        sellingPrice: Number(order.sellingPrice ?? 0),
        currency: order.currency,
        suggestedBuyingPrice: null,
        sellerFee: Number(order.sellerFee ?? 0),
        shippingFee: Number(order.shippingFee ?? 0),
    }));
    // Render client component with server-provided orders and disable client fetch
    return (0, jsx_runtime_1.jsx)(UnpricedOrdersCard_1.default, { initialOrders: orders, disableFetch: true });
}
