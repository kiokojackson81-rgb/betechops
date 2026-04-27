import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("search") || "").trim();
  const activeOnly = ["1", "true", "yes"].includes((searchParams.get("activeOnly") || "").toLowerCase());
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "10")));
  if (!q && !activeOnly) return NextResponse.json([]);

  const products = await prisma.product.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      sellingPrice: true,
      lastBuyingPrice: true,
      defaultWarranty: true,
      isActive: true,
      commissionEnabled: true,
      commissionAmount: true,
      commissionRequiresApproval: true,
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: limit,
  }).catch(() => []);

  return NextResponse.json(products);
}
