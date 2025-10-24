import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string })?.role;
  if (!session || !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take") || 20)));

  const where: Prisma.OrderWhereInput = { status: { in: ["PENDING", "PROCESSING"] } };
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
  { customerName: { contains: q, mode: "insensitive" } },
      { shop: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rowsRaw = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      shop: { select: { name: true } },
      items: { include: { product: { select: { lastBuyingPrice: true, sellingPrice: true } } } },
    },
  });

  const rows = rowsRaw.map((o) => {
    const itemsCount = (o.items || []).reduce((acc: number, x) => acc + (x.quantity ?? 0), 0);
    const sellingTotal = (o.items || []).reduce((acc: number, x) => {
      const sp = ((x.sellingPrice ?? x.product?.sellingPrice ?? 0) as number) * (x.quantity ?? 0);
      return acc + sp;
    }, 0);
    const hasBuyingPrice = (o.items || []).every((x) => typeof x.product?.lastBuyingPrice === "number");
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName ?? null,
      itemsCount,
      sellingTotal,
      hasBuyingPrice,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt.toISOString(),
    };
  });

  return NextResponse.json(rows);
}