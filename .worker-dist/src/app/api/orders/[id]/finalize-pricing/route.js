"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
/**
 * Finalizes pricing by computing totalAmount from items:
 * - prefer item.subtotal if present
 * - else (item.price ?? product.sellingPrice) * quantity
 * Sets status = CONFIRMED
 */
async function POST(_, { params }) {
    try {
        const { id } = await params;
        const order = await prisma_1.prisma.order.findUnique({
            where: { id },
            include: {
                items: {
                    select: {
                        id: true, quantity: true, sellingPrice: true,
                        product: { select: { sellingPrice: true } },
                    },
                },
            },
        });
        if (!order)
            return server_1.NextResponse.json({ error: "Order not found" }, { status: 404 });
        const total = order.items.reduce((sum, it) => {
            const unit = typeof it.sellingPrice === "number" ? it.sellingPrice : (it.product?.sellingPrice ?? 0);
            return sum + unit * it.quantity;
        }, 0);
        const updated = await prisma_1.prisma.order.update({
            where: { id },
            data: {
                totalAmount: total,
                status: "PROCESSING",
                updatedAt: new Date(),
            },
        });
        return server_1.NextResponse.json({ ok: true, id: updated.id, total });
    }
    catch (e) {
        console.error("finalize-pricing error:", e);
        return server_1.NextResponse.json({ error: "Failed to finalize pricing" }, { status: 500 });
    }
}
