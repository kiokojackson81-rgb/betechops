import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Finalizes pricing by computing totalAmount from items:
 * - prefer item.subtotal if present
 * - else (item.price ?? product.sellingPrice) * quantity
 * Sets status = CONFIRMED
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          select: {
            id: true, quantity: true, price: true, subtotal: true,
            product: { select: { sellingPrice: true } },
          },
        },
      },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const total = order.items.reduce((sum: number, it: { quantity: number; price?: number | null; subtotal?: number | null; product?: { sellingPrice?: number | null } | null }) => {
      const unit = typeof it.price === "number" ? it.price : (it.product?.sellingPrice ?? 0);
      const sub = typeof it.subtotal === "number" ? it.subtotal : unit * it.quantity;
      return sum + sub;
    }, 0);

    const updated = await prisma.order.update({
      where: { id },
      data: {
        totalAmount: total,
        status: "CONFIRMED",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, id: updated.id, total });
  } catch (e: unknown) {
    console.error("finalize-pricing error:", e);
    return NextResponse.json({ error: "Failed to finalize pricing" }, { status: 500 });
  }
}