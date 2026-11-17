import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessDocument, resolveDocument } from "@/lib/documentAccess";
import { initiateStkPushForResource } from "@/lib/mpesa";
import { prisma } from "@/lib/prisma";

const schema = z.object({ phoneNumber: z.string().trim().min(8).max(30), amount: z.coerce.number().int().positive() });
const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const document = await resolveDocument("receipt", token);
  if (!document || !await canAccessDocument(document)) return NextResponse.json({ error: "This receipt link is not authorised for payment." }, { status: 403 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Enter a valid Kenyan M-Pesa number and payment amount." }, { status: 400 });
  const receipt = await prisma.receipt.findUnique({ where: { id: document.receiptId }, include: { order: { select: { id: true, orderNumber: true, totalAmount: true, paidAmount: true, status: true } } } });
  if (!receipt?.order || String(record(receipt.data).customerType || "").toLowerCase() !== "delivery") return NextResponse.json({ error: "Delivery payment record was not found." }, { status: 404 });
  if (["CANCELED", "CANCELLED"].includes(receipt.order.status)) return NextResponse.json({ error: "A cancelled delivery cannot receive payment." }, { status: 409 });
  const outstanding = Math.max(0, Number(receipt.order.totalAmount) - Number(receipt.order.paidAmount));
  if (input.data.amount > outstanding || outstanding < 1) return NextResponse.json({ error: "This delivery has no payable outstanding balance." }, { status: 409 });
  try {
    const payment = await initiateStkPushForResource({
      resourceType: "ORDER",
      orderId: receipt.order.id,
      reference: receipt.order.orderNumber,
      phoneNumber: input.data.phoneNumber,
      installmentAmount: input.data.amount,
    });
    return NextResponse.json({ ok: true, ...payment, balance: outstanding }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send the M-Pesa Express prompt." }, { status: 502 });
  }
}
