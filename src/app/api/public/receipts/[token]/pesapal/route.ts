import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessDocument, resolveDocument } from "@/lib/documentAccess";
import { createPesapalCheckout, pesapalIsConfigured } from "@/lib/pesapal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const schema = z.object({ amount: z.coerce.number().int().positive() });

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  if (!pesapalIsConfigured()) return NextResponse.json({ error: "Pesapal web payment is not configured yet." }, { status: 503 });
  const { token } = await context.params;
  const document = await resolveDocument("receipt", token);
  if (!document || !await canAccessDocument(document)) return NextResponse.json({ error: "This receipt link is not authorised for payment." }, { status: 403 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Enter a valid whole-KES amount." }, { status: 400 });
  const receipt = await prisma.receipt.findUnique({ where: { id: document.receiptId }, include: { order: true } });
  if (!receipt?.order || receipt.order.status === "CANCELED") return NextResponse.json({ error: "This order cannot receive a payment." }, { status: 409 });
  const receiptData = receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
    ? receipt.data as Record<string, unknown>
    : {};
  const podDelivery = receiptData.podDelivery && typeof receiptData.podDelivery === "object" && !Array.isArray(receiptData.podDelivery)
    ? receiptData.podDelivery as Record<string, unknown>
    : null;
  const isSpeedafCollection = String(receiptData.customerType || "").trim().toLowerCase() === "pod" || Boolean(podDelivery && !podDelivery.directDelivery);
  if (isSpeedafCollection) return NextResponse.json({ error: "Pesapal is not available for Speedaf collection orders. Pay when you collect your order." }, { status: 409 });
  const balance = Math.max(0, Number(receipt.order.totalAmount) - Number(receipt.order.paidAmount));
  if (input.data.amount > balance || balance < 1) return NextResponse.json({ error: "This receipt has no payable outstanding balance." }, { status: 409 });
  try {
    const checkout = await createPesapalCheckout({ orderId: receipt.order.id, receiptId: receipt.id, receiptToken: token, orderNumber: receipt.order.orderNumber, customerName: receipt.order.customerName, customerPhone: receipt.order.customerPhone, customerEmail: receipt.order.customerEmail, amount: input.data.amount });
    return NextResponse.json({ ok: true, ...checkout }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to begin Pesapal checkout." }, { status: 502 });
  }
}
