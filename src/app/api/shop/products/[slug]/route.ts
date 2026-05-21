import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMockProductsResponse, isShopOpsApiEnabled } from "@/app/shop/integrationPlan";
import { getOpsCatalogueProductsReadOnly } from "@/app/shop/shopProductMapper";
import { allShopProducts } from "@/app/shop/shopData";

const paramsSchema = z.object({
  slug: z.string().trim().min(1),
});

// TODO: Keep product lookup read-only until live ecommerce order handling is approved.
export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const parsed = paramsSchema.safeParse(await context.params);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid product slug." }, { status: 400 });
  }

  if (!isShopOpsApiEnabled()) {
    const product = allShopProducts.find((item) => item.slug === parsed.data.slug) ?? null;

    return NextResponse.json({
      ...buildMockProductsResponse(product ? [product] : []),
      product,
    });
  }

  try {
    const product = (await getOpsCatalogueProductsReadOnly()).find((item) => item.slug === parsed.data.slug) ?? null;

    return NextResponse.json({
      ok: true,
      source: "ops" as const,
      useOpsApi: true,
      product,
    });
  } catch (error) {
    console.error(`[shop] failed to read ops catalogue product for slug ${parsed.data.slug}; using mock fallback`, error);

    const product = allShopProducts.find((item) => item.slug === parsed.data.slug) ?? null;

    return NextResponse.json({
      ...buildMockProductsResponse(product ? [product] : []),
      product,
      warning:
        process.env.NODE_ENV !== "production"
          ? "Ops catalogue read failed. Returning mock shop product instead."
          : undefined,
    });
  }
}
