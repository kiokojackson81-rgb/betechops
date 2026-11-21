import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWebsiteOrderPesapalCheckout, pesapalIsConfigured } from "@/lib/pesapal";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ orderRef: string }> }) {
  if (!pesapalIsConfigured()) return NextResponse.json({ error: "Pesapal web payment is not configured yet." }, { status: 503 });
  const { orderRef } = await context.params;
  const body = await request.json().catch(() => ({}));
  const order = await prisma.websiteOrder.findUnique({ where: { orderRef }, select: { id: true, orderRef: true, customerName: true, customerPhone: true, customerEmail: true, total: true, status: true, metadata: true } });
  if (!order || order.status !== "AWAITING_PAYMENT") return NextResponse.json({ error: "This checkout is no longer awaiting payment." }, { status: 409 });
  const metadata = order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata) ? order.metadata as Record<string, unknown> : {};
  if (String(metadata.paymentAccessToken || "") !== String(body.paymentAccessToken || "")) return NextResponse.json({ error: "This checkout payment session has expired. Return to checkout and try again." }, { status: 403 });
  const amount = Math.round(Number(metadata.amountDueNow || 0));
  if (amount < 1) return NextResponse.json({ error: "This order has no payment due now." }, { status: 409 });
  try {
    return NextResponse.json({ ok: true, ...(await createWebsiteOrderPesapalCheckout({ websiteOrderId: order.id, orderRef: order.orderRef, customerName: order.customerName, customerPhone: order.customerPhone, customerEmail: order.customerEmail, amount })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start Pesapal checkout." }, { status: 502 });
  }
}
