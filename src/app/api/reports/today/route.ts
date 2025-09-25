/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string })?.role;
  if (!session || !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const shopId = searchParams.get("shopId") || undefined;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const where: any = { createdAt: { gte: start, lte: end }, ...(shopId ? { shopId } : {}), status: { in: ["PENDING", "PROCESSING", "FULFILLED", "COMPLETED"] } };

  const orders = await prisma.order.findMany({ where, select: { id: true, totalAmount: true, items: true as any } as any });

  const revenue = orders.reduce((acc: number, o: any) => {
    const fallback = (o.items || []).reduce((a: number, it: any) => a + (it.sellingPrice ?? 0) * (it.quantity ?? 0), 0) ?? 0;
    return acc + (o.totalAmount ?? fallback);
  }, 0);

  const ordersToday = orders.length;
  const avgOrder = ordersToday ? revenue / ordersToday : 0;

  let lowStockCount = 0;
  try {
    lowStockCount = await prisma.product.count({ where: { stockQuantity: { lt: prisma.product.fields.minStockLevel } as any } }).catch(async () => {
      const products = await prisma.product.findMany({ select: { stockQuantity: true, minStockLevel: true } as any });
      return products.filter((p: any) => (p.stockQuantity ?? 0) < (p.minStockLevel ?? 0)).length;
    });
  } catch {
    lowStockCount = 0;
  }

  let openReturns = 0;
  try {
    // use bracket access in case Return model doesn't exist in schema
  openReturns = await (prisma as any)["return"].count({ where: { status: { in: ["OPEN", "PENDING", "WAITING_PICKUP"] }, ...(shopId ? { shopId } : {}) } as any });
  } catch {
    openReturns = 0;
  }

  return NextResponse.json({ revenueToday: Math.round(revenue), ordersToday, avgOrder: Math.round(avgOrder), lowStockCount, openReturns });
}
