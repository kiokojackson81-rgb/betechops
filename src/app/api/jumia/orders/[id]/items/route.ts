import { NextRequest, NextResponse } from "next/server";
import { jumiaFetch, loadShopAuthById, loadDefaultShopAuth } from "@/lib/jumia";
import { aggregateItemsDetails } from "@/lib/jumia/orderHelpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "order id required" }, { status: 400 });

  try {
    const url = new URL(req.url);
    const shopId = url.searchParams.get("shopId") || undefined;
    const shopAuth = shopId ? await loadShopAuthById(shopId).catch(() => undefined) : await loadDefaultShopAuth();

    const resp = await jumiaFetch(`/orders/items?orderId=${encodeURIComponent(id)}`, shopAuth ? ({ shopAuth } as any) : ({} as any));
    const items = Array.isArray((resp as any)?.items)
      ? (resp as any).items as Array<Record<string, unknown>>
      : [];

    // Try to infer country code from first item
    const first = (items[0] || {}) as Record<string, any>;
    const countryCode: string | undefined = (first?.country?.code as string) || undefined;

    const agg = aggregateItemsDetails(items, { countryCode });

    return NextResponse.json({
      itemsCount: items.length,
      items,
      ...agg,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg, itemsCount: 0, items: [] }, { status: 500 });
  }
}
