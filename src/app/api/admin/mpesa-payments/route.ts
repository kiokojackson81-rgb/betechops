import { MpesaPaymentChannel, MpesaPaymentStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWebsiteOrdersAdmin } from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

function number(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function date(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serialize(payment: {
  id: string;
  channel: MpesaPaymentChannel;
  status: MpesaPaymentStatus;
  accountReference: string | null;
  requestedAmount: unknown;
  amount: unknown;
  phoneNumber: string | null;
  merchantRequestId: string | null;
  checkoutRequestId: string | null;
  receiptNumber: string | null;
  transactionId: string | null;
  resultCode: number | null;
  resultDescription: string | null;
  transactionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  order: { id: string; orderNumber: string; totalAmount: number; paidAmount: number; paymentStatus: string } | null;
  websiteOrder: { id: string; orderRef: string; total: unknown; metadata: unknown; status: string } | null;
}) {
  const websiteMetadata = payment.websiteOrder?.metadata && typeof payment.websiteOrder.metadata === "object"
    ? payment.websiteOrder.metadata as Record<string, unknown>
    : {};
  return {
    id: payment.id,
    channel: payment.channel,
    status: payment.status,
    accountReference: payment.accountReference,
    requestedAmount: payment.requestedAmount == null ? null : number(payment.requestedAmount),
    amount: payment.amount == null ? null : number(payment.amount),
    phoneNumber: payment.phoneNumber,
    merchantRequestId: payment.merchantRequestId,
    checkoutRequestId: payment.checkoutRequestId,
    receiptNumber: payment.receiptNumber,
    transactionId: payment.transactionId,
    resultCode: payment.resultCode,
    resultDescription: payment.resultDescription,
    transactionAt: date(payment.transactionAt),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    order: payment.order ? {
      kind: "ORDER" as const,
      id: payment.order.id,
      reference: payment.order.orderNumber,
      total: number(payment.order.totalAmount),
      paid: number(payment.order.paidAmount),
      paymentStatus: payment.order.paymentStatus,
    } : payment.websiteOrder ? {
      kind: "WEBSITE_ORDER" as const,
      id: payment.websiteOrder.id,
      reference: payment.websiteOrder.orderRef,
      total: number(payment.websiteOrder.total),
      paid: number(websiteMetadata.amountPaid),
      paymentStatus: String(websiteMetadata.mpesaPaymentStatus || payment.websiteOrder.status),
    } : null,
  };
}

export async function GET(request: NextRequest) {
  const guard = await requireWebsiteOrdersAdmin();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() || "";
  const accountReference = params.get("accountReference")?.trim() || "";
  const phoneNumber = params.get("phoneNumber")?.trim() || "";
  const status = params.get("status") || "ALL";
  const channel = params.get("channel") || "ALL";
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const where: Prisma.MpesaPaymentWhereInput = {
    ...(status !== "ALL" && Object.values(MpesaPaymentStatus).includes(status as MpesaPaymentStatus)
      ? { status: status as MpesaPaymentStatus }
      : {}),
    ...(channel !== "ALL" && Object.values(MpesaPaymentChannel).includes(channel as MpesaPaymentChannel)
      ? { channel: channel as MpesaPaymentChannel }
      : {}),
    ...(accountReference ? { accountReference: { contains: accountReference, mode: "insensitive" } } : {}),
    ...(phoneNumber ? { phoneNumber: { contains: phoneNumber } } : {}),
    ...(query ? {
      OR: [
        { transactionId: { contains: query, mode: "insensitive" } },
        { receiptNumber: { contains: query, mode: "insensitive" } },
        { accountReference: { contains: query, mode: "insensitive" } },
        { phoneNumber: { contains: query } },
        { merchantRequestId: { contains: query, mode: "insensitive" } },
        { checkoutRequestId: { contains: query, mode: "insensitive" } },
      ],
    } : {}),
  };
  const createdAt: Prisma.DateTimeFilter = {};
  if (from && !Number.isNaN(Date.parse(from))) createdAt.gte = new Date(`${from}T00:00:00.000Z`);
  if (to && !Number.isNaN(Date.parse(to))) createdAt.lte = new Date(`${to}T23:59:59.999Z`);
  if (Object.keys(createdAt).length) where.createdAt = createdAt;

  const include = {
    order: { select: { id: true, orderNumber: true, totalAmount: true, paidAmount: true, paymentStatus: true } },
    websiteOrder: { select: { id: true, orderRef: true, total: true, metadata: true, status: true } },
  } satisfies Prisma.MpesaPaymentInclude;
  const [payments, successful, unmatched] = await Promise.all([
    prisma.mpesaPayment.findMany({ where, include, orderBy: [{ transactionAt: "desc" }, { createdAt: "desc" }], take: 250 }),
    prisma.mpesaPayment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true }, _count: true }),
    prisma.mpesaPayment.aggregate({ where: { status: "UNMATCHED" }, _sum: { amount: true }, _count: true }),
  ]);

  return NextResponse.json({
    ok: true,
    payments: payments.map(serialize),
    summary: {
      totalReceived: number(successful._sum.amount),
      successfulCount: successful._count,
      unmatchedAmount: number(unmatched._sum.amount),
      unmatchedCount: unmatched._count,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
