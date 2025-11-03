"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
async function POST(req, { params }) {
    var _a, _b;
    try {
        const { id } = await params;
        // Body: { productId: string, lastBuyingPrice: number }
        const body = await req.json().catch(() => ({}));
        const productId = String((body === null || body === void 0 ? void 0 : body.productId) || "");
        const lastBuyingPrice = Number(body === null || body === void 0 ? void 0 : body.lastBuyingPrice);
        if (!productId || !Number.isFinite(lastBuyingPrice) || lastBuyingPrice <= 0) {
            return server_1.NextResponse.json({ error: "Invalid price payload" }, { status: 400 });
        }
        // Optional: verify the order exists (and contains the product)
        const order = await prisma_1.prisma.order.findUnique({
            where: { id },
            include: { items: { select: { productId: true } } },
        });
        if (!order)
            return server_1.NextResponse.json({ error: "Order not found" }, { status: 404 });
        const productInOrder = order.items.some((it) => it.productId === productId);
        if (!productInOrder)
            return server_1.NextResponse.json({ error: "Product not in this order" }, { status: 400 });
        // Update product.lastBuyingPrice
        const updated = await prisma_1.prisma.product.update({
            where: { id: productId },
            data: { lastBuyingPrice: lastBuyingPrice },
        });
        // TODO: Add audit logging when AuditLog table is migrated
        console.log(`Price updated for product ${productId}: ${lastBuyingPrice} by ${(_a = (0, auth_1.getSession)()) === null || _a === void 0 ? void 0 : _a.role}:${(_b = (0, auth_1.getSession)()) === null || _b === void 0 ? void 0 : _b.id}`);
        return server_1.NextResponse.json({ ok: true, productId: updated.id, lastBuyingPrice });
    }
    catch (e) {
        console.error(e);
        return server_1.NextResponse.json({ error: "Failed to set buying price" }, { status: 500 });
    }
}
