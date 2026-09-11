import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createMpesaRefundDraft, requireMpesaRefundAdmin } from "@/lib/mpesaRefunds";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const asNumber = (value: unknown) => Number(value ?? 0);

export async function GET(request: NextRequest) {
  const guard = await requireMpesaRefundAdmin();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const paymentId = request.nextUrl.searchParams.get("paymentId")?.trim();
  const [refunds, payment] = await Promise.all([
    prisma.mpesaRefund.findMany({ include: { originalPayment: { select: { id: true, channel: true, status: true, amount: true, requestedAmount: true, phoneNumber: true, receiptNumber: true, transactionId: true, accountReference: true, order: { select: { orderNumber: true } }, websiteOrder: { select: { orderRef: true } } } }, requestedBy: { select: { name: true, email: true } }, authorizedBy: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    paymentId ? prisma.mpesaPayment.findUnique({ where: { id: paymentId }, include: { order: { select: { orderNumber: true, totalAmount: true, paidAmount: true } }, websiteOrder: { select: { orderRef: true, total: true, metadata: true } }, refunds: { where: { status: "SUCCESS" }, select: { amount: true } } } }) : Promise.resolve(null),
  ]);
  const serialize = (refund: typeof refunds[number]) => ({ id: refund.id, paymentId: refund.originalPaymentId, amount: asNumber(refund.amount), status: refund.status, reason: refund.reason, payer: refund.originalPayerPhone, createdAt: refund.createdAt.toISOString(), authorizedAt: refund.authorizedAt?.toISOString() || null, completedAt: refund.completedAt?.toISOString() || null, providerResultDesc: refund.providerResultDesc, original: { receipt: refund.originalPayment.receiptNumber || refund.originalPayment.transactionId, reference: refund.originalPayment.order?.orderNumber || refund.originalPayment.websiteOrder?.orderRef || refund.originalPayment.accountReference, channel: refund.originalPayment.channel }, requestedBy: refund.requestedBy.name || refund.requestedBy.email || "Administrator", authorizedBy: refund.authorizedBy?.name || refund.authorizedBy?.email || null });
  const paymentDetails = payment ? { id: payment.id, status: payment.status, channel: payment.channel, amount: asNumber(payment.amount ?? payment.requestedAmount), receipt: payment.receiptNumber || payment.transactionId, payer: payment.phoneNumber, reference: payment.order?.orderNumber || payment.websiteOrder?.orderRef || payment.accountReference, linked: payment.order ? { total: asNumber(payment.order.totalAmount), paid: asNumber(payment.order.paidAmount) } : payment.websiteOrder ? { total: asNumber(payment.websiteOrder.total), paid: asNumber((payment.websiteOrder.metadata as Record<string, unknown> | null)?.amountPaid) } : null, refunded: payment.refunds.reduce((total, refund) => total + asNumber(refund.amount), 0) } : null;
  return NextResponse.json({ ok: true, refunds: refunds.map(serialize), payment: paymentDetails }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const guard = await requireMpesaRefundAdmin();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const body = await request.json().catch(() => ({}));
  try {
    const result = await createMpesaRefundDraft({ paymentId: String(body.paymentId || ""), amount: Number(body.amount), reason: String(body.reason || ""), actorId: guard.userId });
    return NextResponse.json({ ok: true, refund: { id: result.refund.id, status: result.refund.status, amount: asNumber(result.refund.amount) } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create refund request" }, { status: 400 });
  }
}
