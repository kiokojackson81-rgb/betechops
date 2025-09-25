/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("search") || "").trim();
  if (!q) return NextResponse.json([]);

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { sku: { contains: q } },
      ],
    },
    select: { id: true, name: true, sku: true, sellingPrice: true, lastBuyingPrice: true } as any,
    take: 10,
  }).catch(() => [] as any);

  return NextResponse.json(products);
}
