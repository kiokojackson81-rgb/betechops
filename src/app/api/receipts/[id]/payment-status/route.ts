import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveParams(context: ParamsContext) {
  const params = context.params;
  return typeof (params as Promise<{ id: string }>).then === "function"
    ? await params as { id: string }
    : params as { id: string };
}

export async function GET(_request: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;

  const { id } = await resolveParams(context);
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: {
      id: true,
      receiptNumber: true,
      order: {
        select: {
          attendantId: true,
          paymentStatus: true,
          paidAmount: true,
          totalAmount: true,
          mpesaPayments: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { channel: true, status: true, receiptNumber: true, resultDescription: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!receipt?.order) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });

  const actorId = (guard.session?.user as { id?: string } | undefined)?.id ?? null;
  if (guard.role === "ATTENDANT" && actorId !== receipt.order.attendantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const latestPayment = receipt.order.mpesaPayments[0] || null;
  return NextResponse.json({
    ok: true,
    confirmed: receipt.order.paymentStatus === "PAID" && Number(receipt.order.paidAmount) >= Number(receipt.order.totalAmount),
    receiptNumber: receipt.receiptNumber,
    latestPayment: latestPayment
      ? { ...latestPayment, createdAt: latestPayment.createdAt.toISOString() }
      : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
