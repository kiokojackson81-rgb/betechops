"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
async function POST(req, { params }) {
    try {
        const { id } = await params;
        // Body: { productId: string, lastBuyingPrice: number }
        const body = await req.json().catch(() => ({}));
        const productId = String(body?.productId || "");
        const lastBuyingPrice = Number(body?.lastBuyingPrice);
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
        console.log(`Price updated for product ${productId}: ${lastBuyingPrice} by ${(0, auth_1.getSession)()?.role}:${(0, auth_1.getSession)()?.id}`);
        return server_1.NextResponse.json({ ok: true, productId: updated.id, lastBuyingPrice });
    }
    catch (e) {
        console.error(e);
        return server_1.NextResponse.json({ error: "Failed to set buying price" }, { status: 500 });
    }
}
