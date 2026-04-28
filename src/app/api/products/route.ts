import { NextResponse } from "next/server";
import { getProductSimilarityScore } from "@/lib/posProductSimilarity";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("search") || "").trim();
  const activeOnly = ["1", "true", "yes"].includes((searchParams.get("activeOnly") || "").toLowerCase());
  const limit = Math.min(2000, Math.max(1, Number(searchParams.get("limit") || "10")));
  if (!q && !activeOnly) return NextResponse.json([]);
  const searchTokens = q
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 8);

  const products = await prisma.product.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
              ...searchTokens.flatMap((token) => [
                { name: { contains: token, mode: "insensitive" as const } },
                { sku: { contains: token, mode: "insensitive" as const } },
                { category: { contains: token, mode: "insensitive" as const } },
              ]),
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
      _count: {
        select: {
          orders: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: q ? Math.min(2000, Math.max(limit * 6, 120)) : limit,
  }).catch(() => []);

  const rankedProducts = products
    .map((product) => ({
      ...product,
      soldCount: Number(product._count?.orders ?? 0),
      _count: undefined,
    }))
    .sort((left, right) => {
      if (!q) {
        return (
          Number(right.soldCount ?? 0) - Number(left.soldCount ?? 0) ||
          left.name.localeCompare(right.name)
        );
      }

      const rightScore = getProductSimilarityScore(q, right.name);
      const leftScore = getProductSimilarityScore(q, left.name);
      return (
        rightScore - leftScore ||
        Number(right.soldCount ?? 0) - Number(left.soldCount ?? 0) ||
        left.name.localeCompare(right.name)
      );
    })
    .slice(0, limit);

  return NextResponse.json(rankedProducts);
}
