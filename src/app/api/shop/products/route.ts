import { NextResponse } from "next/server";
import { buildMockProductsResponse, isShopOpsApiEnabled } from "@/app/shop/integrationPlan";
import { filterShopProducts, getOpsCatalogueProductsReadOnlyMapped } from "@/app/shop/shopProductMapper";
import { allShopProducts } from "@/app/shop/shopData";

// TODO: Keep catalogue reads read-only until live ecommerce order handling is approved.
// TODO: Do not create POS records, receipts, stock deductions, or payments from /shop in Phase 9.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const subcategory = searchParams.get("subcategory");
  const q = searchParams.get("q");
  const fallback = buildMockProductsResponse(filterShopProducts(allShopProducts, { category, subcategory, q }));

  if (!isShopOpsApiEnabled()) {
    return NextResponse.json(fallback);
  }

  try {
    const products = filterShopProducts(await getOpsCatalogueProductsReadOnlyMapped(), { category, subcategory, q });

    if (!products.length) {
      return NextResponse.json({
        ...fallback,
        warning:
          process.env.NODE_ENV !== "production"
            ? "Ops catalogue returned no valid solar products; using mock fallback."
            : undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      source: "ops" as const,
      useOpsApi: true,
      products,
    });
  } catch (error) {
    console.error("[shop] failed to read ops catalogue products; using mock fallback", error);

    return NextResponse.json({
      ...fallback,
      warning:
        process.env.NODE_ENV !== "production"
          ? "Ops catalogue read failed. Returning mock shop products instead."
          : undefined,
    });
  }
}
