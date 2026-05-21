import { NextResponse } from "next/server";
import { buildMockProductsResponse, isShopOpsApiEnabled } from "@/app/shop/integrationPlan";
import { filterShopProducts, getOpsCatalogueProductsReadOnly } from "@/app/shop/shopProductMapper";
import { allShopProducts } from "@/app/shop/shopData";

// TODO: Keep catalogue reads read-only until live ecommerce order handling is approved.
// TODO: Do not create POS records, receipts, stock deductions, or payments from /shop in Phase 9.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  if (!isShopOpsApiEnabled()) {
    return NextResponse.json(buildMockProductsResponse(filterShopProducts(allShopProducts, { category, q })));
  }

  try {
    const products = filterShopProducts(await getOpsCatalogueProductsReadOnly(), { category, q });

    return NextResponse.json({
      ok: true,
      source: "ops" as const,
      useOpsApi: true,
      products,
    });
  } catch (error) {
    console.error("[shop] failed to read ops catalogue products; using mock fallback", error);

    return NextResponse.json({
      ...buildMockProductsResponse(filterShopProducts(allShopProducts, { category, q })),
      warning:
        process.env.NODE_ENV !== "production"
          ? "Ops catalogue read failed. Returning mock shop products instead."
          : undefined,
    });
  }
}
