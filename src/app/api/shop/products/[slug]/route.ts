import { NextResponse } from "next/server";
import { z } from "zod";
import { allShopProducts } from "@/app/shop/shopData";

const paramsSchema = z.object({
  slug: z.string().trim().min(1),
});

// TODO: Replace mock slug lookup with Prisma-backed ops catalogue lookup.
export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const parsed = paramsSchema.safeParse(await context.params);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid product slug." }, { status: 400 });
  }

  const product = allShopProducts.find((item) => item.slug === parsed.data.slug) ?? null;

  return NextResponse.json({
    ok: true,
    source: "mock" as const,
    product,
  });
}
