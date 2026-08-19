import { NextResponse } from "next/server";
import { buildMockProductsResponse, isShopOpsApiEnabled } from "@/app/shop/integrationPlan";
import { filterShopProducts, getOpsCatalogueProductsReadOnlyMapped } from "@/app/shop/shopProductMapper";
import { allShopProducts, type ShopProduct } from "@/app/shop/shopData";

// TODO: Keep catalogue reads read-only until live ecommerce order handling is approved.
// TODO: Do not create POS records, receipts, stock deductions, or payments from /shop in Phase 9.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const subcategory = searchParams.get("subcategory");
  const q = searchParams.get("q");
  const eligibleOnly = searchParams.get("lipaPolePole") === "eligible";
  const keepEligible = (products: ShopProduct[]) =>
    eligibleOnly
      ? products.filter((product) => product.lipaPolePoleEnabled && product.opsProductId)
      : products;
  const fallback = buildMockProductsResponse(
    keepEligible(filterShopProducts(allShopProducts, { category, subcategory, q })),
  );

  if (!isShopOpsApiEnabled()) {
    return NextResponse.json(fallback);
  }

  try {
    const products = keepEligible(
      filterShopProducts(await getOpsCatalogueProductsReadOnlyMapped(), { category, subcategory, q }),
    );

    return NextResponse.json(
      {
        ok: true,
        source: "ops" as const,
        useOpsApi: true,
        products,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("[shop] failed to read ops catalogue products in live mode", error);
    return NextResponse.json(
      {
        ok: false,
        source: "ops" as const,
        useOpsApi: true,
        products: [],
        error: "Ops catalogue read failed.",
      },
      { status: 503 },
    );
  }
}
