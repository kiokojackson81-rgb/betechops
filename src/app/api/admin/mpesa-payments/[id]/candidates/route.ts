import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWebsiteOrdersAdmin } from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

function number(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function metadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireWebsiteOrdersAdmin();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const { id } = await params;
  const payment = await prisma.mpesaPayment.findUnique({ where: { id }, select: { id: true, channel: true, status: true } });
  if (!payment) return NextResponse.json({ ok: false, error: "M-Pesa payment was not found" }, { status: 404 });
  if (payment.channel !== "C2B" || payment.status !== "UNMATCHED") {
    return NextResponse.json({ ok: false, error: "Only unmatched C2B payments can be reconciled" }, { status: 409 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const orderWhere = {
    status: { not: "CANCELED" as const },
    ...(query ? {
      OR: [
        { orderNumber: { contains: query, mode: "insensitive" as const } },
        { customerName: { contains: query, mode: "insensitive" as const } },
        { customerPhone: { contains: query } },
        { receipt: { receiptNumber: { contains: query, mode: "insensitive" as const } } },
      ],
    } : {}),
  };
  const websiteWhere = {
    status: { not: "CANCELLED" as const },
    ...(query ? {
      OR: [
        { orderRef: { contains: query, mode: "insensitive" as const } },
        { customerName: { contains: query, mode: "insensitive" as const } },
        { customerPhone: { contains: query } },
      ],
    } : {}),
  };
  const [orders, websiteOrders] = await Promise.all([
    prisma.order.findMany({ where: orderWhere, select: { id: true, orderNumber: true, customerName: true, customerPhone: true, totalAmount: true, paidAmount: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.websiteOrder.findMany({ where: websiteWhere, select: { id: true, orderRef: true, customerName: true, customerPhone: true, total: true, metadata: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return NextResponse.json({
    ok: true,
    candidates: [
      ...orders.map((order) => ({ kind: "ORDER" as const, id: order.id, reference: order.orderNumber, customerName: order.customerName, customerPhone: order.customerPhone, total: number(order.totalAmount), paid: number(order.paidAmount) })),
      ...websiteOrders.map((order) => ({ kind: "WEBSITE_ORDER" as const, id: order.id, reference: order.orderRef, customerName: order.customerName, customerPhone: order.customerPhone, total: number(order.total), paid: number(metadata(order.metadata).amountPaid) })),
    ],
  }, { headers: { "Cache-Control": "no-store" } });
}
