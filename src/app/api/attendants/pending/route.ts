import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * ?q= search (orderNumber, customerName, phone, shop)
 * ?take= number (default 20)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take") || 20)));

  const where: {
    status: "PENDING";
    OR?: Array<{
      orderNumber?: { contains: string; mode: "insensitive" };
      customerName?: { contains: string; mode: "insensitive" };
      customerPhone?: { contains: string; mode: "insensitive" };
      shop?: { name?: { contains: string; mode: "insensitive" } };
    }>;
  } = { status: "PENDING" };
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q, mode: "insensitive" } },
      { shop: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      shop: { select: { name: true } },
      items: {
        select: {
          id: true, quantity: true, price: true, subtotal: true,
          product: { select: { id: true, sku: true, name: true, sellingPrice: true, actualPrice: true } },
        },
      },
    },
  });

  return NextResponse.json({ rows });
}