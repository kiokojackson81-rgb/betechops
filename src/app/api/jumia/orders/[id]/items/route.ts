import { NextRequest, NextResponse } from "next/server";
import { jumiaFetch, loadShopAuthById, loadDefaultShopAuth } from "@/lib/jumia";
import { aggregateItemsDetails } from "@/lib/jumia/orderHelpers";
import { prisma } from "@/lib/prisma";
import { Platform } from "@prisma/client";

export const dynamic = "force-dynamic";

const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_ID_CANDIDATE_KEYS = new Set([
  "id",
  "orderId",
  "order_id",
  "number",
  "orderNumber",
  "displayOrderNumber",
  "customerOrderId",
  "customer_order_id",
  "orderNo",
  "order_no",
  "orderNr",
  "incrementId",
  "increment_id",
  "reference",
  "referenceId",
  "reference_id",
]);

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

function hasUsableCredentials(auth: unknown): auth is { clientId: string; refreshToken: string } {
  const record = asRecord(auth);
  return Boolean(
    record &&
    typeof record.clientId === "string" &&
    record.clientId.trim() &&
    typeof record.refreshToken === "string" &&
    record.refreshToken.trim(),
  );
}

function readString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function isUuidLike(value: string | undefined | null): value is string {
  return Boolean(value && UUID_LIKE_PATTERN.test(value.trim()));
}

function collectOrderIdCandidates(...sources: unknown[]): string[] {
  const results = new Set<string>();
  const visited = new Set<unknown>();

  const visit = (value: unknown, depth: number) => {
    if (value == null || depth > 3) return;
    if (typeof value === "string" || typeof value === "number") {
      const resolved = readString(value);
      if (resolved) results.add(resolved);
      return;
    }
    if (typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }

    for (const [key, nested] of Object.entries(value)) {
      if (ORDER_ID_CANDIDATE_KEYS.has(key)) {
        const resolved = readString(nested);
        if (resolved) results.add(resolved);
      }
      if (
        key === "order" ||
        key === "data" ||
        key === "payload" ||
        key === "meta" ||
        key === "result"
      ) {
        visit(nested, depth + 1);
      }
    }
  };

  for (const source of sources) visit(source, 0);
  return Array.from(results);
}

async function loadFallbackItems(orderId: string) {
  const orderRow = await prisma.jumiaOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      shopId: true,
      isPrepayment: true,
      totalAmountLocalCurrency: true,
      totalAmountLocalValue: true,
    },
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
      account: { select: { displayName: true, jumiaShopSid: true } },
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

  const marketplaceShopSids = Array.from(
    new Set(
      marketplaceRows
        .map((row) => String(row.account.jumiaShopSid ?? "").trim())
        .filter(Boolean),
    ),
  );

  return { items, orderMeta: orderRow, marketplaceShopSids };
}

async function resolveShopAuthForOrder({
  orderId,
  requestedShopId,
  fallbackShopId,
  marketplaceShopSids,
}: {
  orderId: string;
  requestedShopId?: string;
  fallbackShopId?: string | null;
  marketplaceShopSids?: string[];
}) {
  const candidateShopIds = new Set<string>();

  if (requestedShopId) {
    candidateShopIds.add(requestedShopId);

    const [shopRow, marketplaceAccountRow] = await Promise.all([
      prisma.shop.findUnique({
        where: { id: requestedShopId },
        select: { jumiaShopSid: true },
      }).catch(() => null),
      prisma.marketplaceAccount.findUnique({
        where: { id: requestedShopId },
        select: { jumiaShopSid: true },
      }).catch(() => null),
    ]);

    if (shopRow?.jumiaShopSid) candidateShopIds.add(shopRow.jumiaShopSid);
    if (marketplaceAccountRow?.jumiaShopSid) candidateShopIds.add(marketplaceAccountRow.jumiaShopSid);
  }

  if (fallbackShopId) candidateShopIds.add(fallbackShopId);
  for (const shopSid of marketplaceShopSids ?? []) candidateShopIds.add(shopSid);

  for (const candidateShopId of candidateShopIds) {
    const auth = await loadShopAuthById(candidateShopId).catch(() => undefined);
    if (hasUsableCredentials(auth)) {
      return { shopAuth: auth, shopKey: candidateShopId, source: "shop" as const };
    }
  }

  const defaultAuth = await loadDefaultShopAuth().catch(() => undefined);
  if (hasUsableCredentials(defaultAuth)) {
    return { shopAuth: defaultAuth, shopKey: requestedShopId ?? fallbackShopId ?? orderId, source: "default" as const };
  }

  return { shopAuth: undefined, shopKey: requestedShopId ?? fallbackShopId ?? orderId, source: "none" as const };
}

async function fetchItemsPayload(
  orderId: string,
  shopAuth?: unknown,
  shopKey?: string,
  fallbackOrderNumber?: string | null,
  fallbackItems?: Array<Record<string, unknown>>,
) {
  const candidates = collectOrderIdCandidates(
    { id: orderId, number: fallbackOrderNumber ?? undefined },
    ...(fallbackItems ?? []),
  );
  const uuidCandidates = candidates.filter((candidate) => isUuidLike(candidate));

  if (!uuidCandidates.length) {
    return { payload: null, resolvedOrderId: orderId, error: null };
  }

  let lastPayload: unknown = null;
  let lastError: unknown = null;

  for (const candidate of uuidCandidates) {
    try {
      const payload = await jumiaFetch(
        `/orders/items?orderId=${encodeURIComponent(candidate)}`,
        shopAuth ? ({ shopAuth, shopKey } as any) : ({} as any),
      );
      lastPayload = payload;
      if (extractItems(payload).length > 0) {
        return { payload, resolvedOrderId: candidate, error: null };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastPayload) return { payload: lastPayload, resolvedOrderId: orderId, error: null };
  if (lastError) throw lastError;
  return { payload: null, resolvedOrderId: orderId, error: null };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "order id required" }, { status: 400 });

  try {
    const url = new URL(req.url);
    const requestedShopId = url.searchParams.get("shopId") || undefined;
    const fallback = await loadFallbackItems(id);
    const authResolution = await resolveShopAuthForOrder({
      orderId: id,
      requestedShopId,
      fallbackShopId: fallback.orderMeta?.shopId,
      marketplaceShopSids: fallback.marketplaceShopSids,
    });

    let fetched = await fetchItemsPayload(
      id,
      authResolution.shopAuth,
      authResolution.shopKey,
      fallback.orderMeta?.number ? String(fallback.orderMeta.number) : null,
      fallback.items,
    );
    let resp = fetched.payload;
    let items = extractItems(resp);

    if (items.length === 0 && requestedShopId && authResolution.source !== "default") {
      const defaultAuth = await loadDefaultShopAuth().catch(() => undefined);
      if (hasUsableCredentials(defaultAuth)) {
        fetched = await fetchItemsPayload(
          id,
          defaultAuth,
          requestedShopId,
          fallback.orderMeta?.number ? String(fallback.orderMeta.number) : null,
          fallback.items,
        );
        resp = fetched.payload;
        items = extractItems(resp);
      }
    }

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
      orderId: fetched.resolvedOrderId ?? id,
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
      error:
        items.length === 0
          ? readSoftError(resp)
          : undefined,
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

function readSoftError(payload: unknown): string | undefined {
  const root = asRecord(payload);
  if (!root) return undefined;
  const direct = typeof root.error === "string" && root.error.trim() ? root.error.trim() : undefined;
  if (direct) return direct;
  const data = asRecord(root.data);
  if (data && typeof data.error === "string" && data.error.trim()) return data.error.trim();
  return undefined;
}
