/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(_: Request, context: any) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string })?.role;
  if (!session || !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = (context?.params as any)?.id as string | undefined;
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, totalAmount: true, items: true as any } as any }).catch(() => null as any);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const computedTotal = order.items?.reduce((acc: number, x: any) => acc + (x.sellingPrice ?? 0) * (x.quantity ?? 0), 0) ?? 0;
  const total = (order.totalAmount ?? 0) > 0 ? order.totalAmount : computedTotal;

  await prisma.order.update({ where: { id }, data: { paidAmount: total as any, paymentStatus: "PAID" as any, status: "PROCESSING" as any } as any }).catch(() => null);
  return NextResponse.json({ ok: true });
}
