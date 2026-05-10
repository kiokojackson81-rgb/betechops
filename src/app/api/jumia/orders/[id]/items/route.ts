import { NextRequest, NextResponse } from "next/server";
import { jumiaFetch, loadShopAuthById, loadDefaultShopAuth } from "@/lib/jumia";
import { aggregateItemsDetails } from "@/lib/jumia/orderHelpers";
import { prisma } from "@/lib/prisma";
import { Platform } from "@prisma/client";

export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractItems(payload: unknown): Array<Record<string, unknown>> {
  const root = asRecord(payload);
  if (!root) return [];

  const candidates: unknown[] = [
    root.items,
    root.orderItems,
    root.order_items,
    root.list,
    root.data,
    asRecord(root.data)?.items,
    asRecord(root.data)?.orderItems,
    asRecord(root.data)?.order_items,
    asRecord(root.payload)?.items,
    asRecord(root.payload)?.orderItems,
    asRecord(root.result)?.items,
    asRecord(root.result)?.orderItems,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }

  return [];
}

async function loadFallbackItems(orderId: string) {
  const orderRow = await prisma.jumiaOrder.findUnique({
    where: { id: orderId },
    select: { id: true, number: true, isPrepayment: true, totalAmountLocalCurrency: true, totalAmountLocalValue: true },
  });

  const orderKeys = Array.from(
    new Set(
      [orderId, orderRow?.number ? String(orderRow.number) : null].filter(
        (value): value is string => Boolean(value && value.trim()),
      ),
    ),
  );

  if (!orderKeys.length) {
    return {
      items: [] as Array<Record<string, unknown>>,
      orderMeta: orderRow,
    };
  }

  const marketplaceRows = await prisma.marketplaceOrder.findMany({
    where: {
      platform: Platform.JUMIA,
      orderId: { in: orderKeys },
    },
    orderBy: [{ orderedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      orderId: true,
      orderItemId: true,
      productName: true,
      productUrl: true,
      sellingPrice: true,
      currency: true,
      rawPayload: true,
      account: { select: { displayName: true } },
    },
  });

  const items = marketplaceRows.map((row) => {
    const raw = asRecord(row.rawPayload) ?? {};
    const product = asRecord(raw.product) ?? {};
    return {
      ...raw,
      id: String(raw.id ?? row.orderItemId ?? row.id),
      orderId: String(raw.orderId ?? row.orderId),
      sellerSku:
        typeof raw.sellerSku === "string"
          ? raw.sellerSku
          : typeof product.sellerSku === "string"
            ? product.sellerSku
            : typeof product.sku === "string"
              ? product.sku
              : undefined,
      productName:
        typeof raw.productName === "string"
          ? raw.productName
          : typeof product.name === "string"
            ? product.name
            : row.productName,
      productUrl:
        typeof raw.productUrl === "string"
          ? raw.productUrl
          : typeof product.url === "string"
            ? product.url
            : row.productUrl ?? undefined,
      totalAmountLocal:
        raw.totalAmountLocal ??
        raw.totalPriceLocal ??
        raw.paidPriceLocal ?? {
          currency: row.currency,
          value: Number(row.sellingPrice ?? 0),
        },
      shopName:
        typeof raw.shopName === "string"
          ? raw.shopName
          : typeof product.shopName === "string"
            ? product.shopName
            : row.account.displayName,
    } satisfies Record<string, unknown>;
  });

  return { items, orderMeta: orderRow };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "order id required" }, { status: 400 });

  try {
    const url = new URL(req.url);
    const shopId = url.searchParams.get("shopId") || undefined;
    const shopAuth = shopId ? await loadShopAuthById(shopId).catch(() => undefined) : await loadDefaultShopAuth();

    const resp = await jumiaFetch(`/orders/items?orderId=${encodeURIComponent(id)}`, shopAuth ? ({ shopAuth } as any) : ({} as any));
    let items = extractItems(resp);
    const fallback = items.length === 0 ? await loadFallbackItems(id) : null;
    if (fallback?.items.length) items = fallback.items;

    // Try to infer country code from first item
    const first = (items[0] || {}) as Record<string, any>;
    const payloadData = asRecord((resp as any)?.data);
    const countryCode: string | undefined =
      (first?.country?.code as string) ||
      (resp as any)?.country ||
      (payloadData?.country as string) ||
      undefined;

    const agg = aggregateItemsDetails(items, { countryCode });

    return NextResponse.json({
      orderId: id,
      itemsCount: items.length,
      items,
      isPrepayment:
        (resp as any)?.isPrepayment ??
        payloadData?.isPrepayment ??
        fallback?.orderMeta?.isPrepayment ??
        undefined,
      totalAmountLocal:
        (resp as any)?.totalAmountLocal ??
        payloadData?.totalAmountLocal ??
        agg.totalAmountLocal ??
        (fallback?.orderMeta?.totalAmountLocalValue != null
          ? {
              currency: fallback.orderMeta.totalAmountLocalCurrency ?? undefined,
              value: Number(fallback.orderMeta.totalAmountLocalValue),
            }
          : undefined),
      ...agg,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    // Improve transparency + graceful handling of common vendor edge cases.
    const err: any = error;
    const status = typeof err?.status === 'number' ? err.status : undefined;
    const body = typeof err?.body === 'string' ? err.body : undefined;
    const msg = error instanceof Error ? error.message : String(error);
    // Treat 404/400 (order extinct or unauthorized for specific item list) as empty list instead of hard failure.
    if (status === 404 || status === 400) {
      return NextResponse.json({
        error: msg,
        vendorStatus: status,
        vendorBody: body?.slice(0, 400),
        itemsCount: 0,
        items: [],
        soft: true,
      }, { status: 200 });
    }
    return NextResponse.json({
      error: msg,
      vendorStatus: status,
      vendorBody: body?.slice(0, 400),
      itemsCount: 0,
      items: [],
    }, { status: 500 });
  }
}
