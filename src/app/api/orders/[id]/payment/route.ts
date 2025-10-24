import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PaymentStatus, OrderStatus } from "@prisma/client";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string })?.role;
  if (!session || !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, totalAmount: true, items: true } }).catch(() => null);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const computedTotal = order.items?.reduce((acc: number, x: { sellingPrice?: number; quantity?: number }) => acc + (x.sellingPrice ?? 0) * (x.quantity ?? 0), 0) ?? 0;
  const total = (order.totalAmount ?? 0) > 0 ? order.totalAmount : computedTotal;

  try {
    await prisma.order.update({ where: { id }, data: { paidAmount: total, paymentStatus: PaymentStatus.PAID, status: OrderStatus.PROCESSING } });
  } catch {
    // swallow update errors; this endpoint is best-effort
  }

  return NextResponse.json({ ok: true });
}
