import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Body: { productId: string, lastBuyingPrice: number }
    const body = await req.json().catch(() => ({}));
    const productId = String(body?.productId || "");
    const lastBuyingPrice = Number(body?.lastBuyingPrice);

    if (!productId || !Number.isFinite(lastBuyingPrice) || lastBuyingPrice <= 0) {
      return NextResponse.json({ error: "Invalid price payload" }, { status: 400 });
    }

    // Optional: verify the order exists (and contains the product)
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { select: { productId: true } } },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const productInOrder = order.items.some((it: { productId?: string | null }) => it.productId === productId);
    if (!productInOrder) return NextResponse.json({ error: "Product not in this order" }, { status: 400 });

    // Update product.actualPrice as the "lastBuyingPrice"
    const updated = await prisma.product.update({
      where: { id: productId },
      data: { actualPrice: lastBuyingPrice },
    });

    // TODO: Add audit logging when AuditLog table is migrated
    console.log(`Price updated for product ${productId}: ${lastBuyingPrice} by ${getSession()?.role}:${getSession()?.id}`);

    return NextResponse.json({ ok: true, productId: updated.id, lastBuyingPrice });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: "Failed to set buying price" }, { status: 500 });
  }
}