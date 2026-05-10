import { Platform } from "@prisma/client";
import { prisma } from "../prisma";
import { JumiaClient } from "./client";
import pLimit from "p-limit";
import { addDays, format } from "date-fns";
import { zonedTimeToUtc } from "date-fns-tz";
import { writePendingSnapshot, type PendingSnapshot } from "./pendingSnapshot";

const API_BASE = "https://vendor-api.jumia.com";
const TOKEN_URL = "https://vendor-api.jumia.com/token";
const LIMIT_RPS = 4;
// Sync window for PENDING orders. Some pending orders can linger for weeks.
// Make this configurable via env JUMIA_PENDING_WINDOW_DAYS, defaulting to 90 days (~3 months of coverage).
const WINDOW_DAYS = Number(process.env.JUMIA_PENDING_WINDOW_DAYS || 90);
// The Jumia API reliably supports page sizes up to 100. Larger values can return 400s.
// Keep this at or below 100 to avoid vendor errors.
const PAGE_SIZE = 100;
const DEFAULT_TIMEZONE = "Africa/Nairobi";

type SyncResult = {
  shopId: string;
  orders: number;
  pages: number;
  error?: string | null;
};

const TRACE_ORDER_NUMBERS = new Set(["352137425", "375645425"]);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[, ]+/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
    if (isRecord(value)) {
      const parsed = readNumber(
        value.value,
        value.amount,
        value.total,
        value.price,
        value.paid,
        value.subtotal,
      );
      if (parsed !== undefined) return parsed;
    }
  }
  return undefined;
}

function pickNestedString(
  sources: Array<Record<string, unknown> | null | undefined>,
  paths: string[][],
): string | undefined {
  for (const source of sources) {
    if (!source) continue;
    for (const path of paths) {
      let current: unknown = source;
      let failed = false;
      for (const key of path) {
        if (!isRecord(current) || !(key in current)) {
          failed = true;
          break;
        }
        current = current[key];
      }
      if (!failed) {
        const resolved = readString(current);
        if (resolved) return resolved;
      }
    }
  }
  return undefined;
}

function joinAddress(parts: Array<string | undefined>): string | undefined {
  const filtered = parts.map((part) => part?.trim()).filter(Boolean) as string[];
  return filtered.length ? filtered.join(", ") : undefined;
}

function extractItemsArray(payload: unknown): Array<Record<string, unknown>> {
  if (!isRecord(payload)) return [];

  const nestedData = isRecord(payload.data) ? payload.data : null;
  const candidates: unknown[] = [
    payload.items,
    payload.orderItems,
    payload.order_items,
    payload.data,
    nestedData?.items,
    nestedData?.orderItems,
    nestedData?.order_items,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate.filter(isRecord);
  }

  return [];
}

function buildProductUrl(countryCode: string | undefined, sellerSku: string | undefined) {
  if (!sellerSku) return undefined;
  const domain = (countryCode || "KE").toUpperCase() === "KE" ? "co.ke" : "com";
  return `https://www.jumia.${domain}/${encodeURIComponent(sellerSku)}`;
}

function traceHydration(orderNumber: string | number | undefined, stage: string, payload: Record<string, unknown>) {
  const normalizedOrderNumber = String(orderNumber ?? "").trim();
  if (!TRACE_ORDER_NUMBERS.has(normalizedOrderNumber)) return;
  console.info(`[jumia.sync][${normalizedOrderNumber}] ${stage}`, payload);
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

async function fetchOrderItemsPayload(client: JumiaClient, rawOrder: Record<string, unknown>) {
  const orderNumber = readString(
    rawOrder.number,
    rawOrder.orderNumber,
    rawOrder.displayOrderNumber,
    rawOrder.customerOrderId,
  );
  const candidates = collectOrderIdCandidates(rawOrder);
  traceHydration(orderNumber, "detail/items candidates", { candidates });

  let lastPayload: unknown = null;
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const payload = await client.call<unknown>(`/orders/items?orderId=${encodeURIComponent(candidate)}`);
      lastPayload = payload;
      const items = extractItemsArray(payload);
      traceHydration(orderNumber, "detail/items fetched", {
        candidate,
        itemCount: items.length,
        payloadKeys: isRecord(payload) ? Object.keys(payload).slice(0, 20) : [],
      });
      if (items.length > 0) return { payload, items, resolvedOrderId: candidate };
    } catch (error) {
      lastError = error;
      traceHydration(orderNumber, "detail/items candidate failed", {
        candidate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (lastPayload) {
    return {
      payload: lastPayload,
      items: extractItemsArray(lastPayload),
      resolvedOrderId: orderNumber ?? readString(rawOrder.id, rawOrder.number) ?? "",
    };
  }

  if (lastError) throw lastError;

  return { payload: null, items: [], resolvedOrderId: orderNumber ?? readString(rawOrder.id, rawOrder.number) ?? "" };
}

type HydratedPendingOrder = {
  totalItems: number | null;
  totalAmountLocalCurrency: string | null;
  totalAmountLocalValue: number | null;
  recipientName: string | null;
  recipientAddress: string | null;
  recipientPhone: string | null;
  shipmentMethod: string | null;
  paymentMethod: string | null;
  shopName: string | null;
  countryCode: string | null;
  items: Array<{
    orderItemId: string;
    productName: string;
    productUrl?: string;
    sellingPrice: number;
    currency: string;
    rawPayload: Record<string, unknown>;
  }>;
};

function hydratePendingOrderDetails(
  rawOrder: Record<string, unknown>,
  payload: unknown,
  items: Array<Record<string, unknown>>,
  fallbackShopName: string | null,
): HydratedPendingOrder {
  const payloadRecord = isRecord(payload) ? payload : null;
  const nestedPayloadData = payloadRecord && isRecord(payloadRecord.data) ? payloadRecord.data : null;
  const firstItem = items[0] ?? null;
  const firstProduct = firstItem && isRecord(firstItem.product) ? firstItem.product : null;
  const firstReceiver = firstItem && isRecord(firstItem.receiver) ? firstItem.receiver : null;
  const firstCustomer = firstItem && isRecord(firstItem.customer) ? firstItem.customer : null;
  const firstAddress = firstItem && isRecord(firstItem.address) ? firstItem.address : null;
  const firstShippingAddress = firstItem && isRecord(firstItem.shippingAddress) ? firstItem.shippingAddress : null;
  const firstPickupStation = firstItem && isRecord(firstItem.pickupStation) ? firstItem.pickupStation : null;
  const firstShipping = firstItem && isRecord(firstItem.shipping) ? firstItem.shipping : null;
  const firstShipment = firstItem && isRecord(firstItem.shipment) ? firstItem.shipment : null;
  const firstDelivery = firstItem && isRecord(firstItem.delivery) ? firstItem.delivery : null;

  const recipientName =
    pickNestedString(
      [
        rawOrder,
        payloadRecord,
        nestedPayloadData,
        firstItem,
        firstReceiver,
        firstCustomer,
        firstAddress,
        firstShippingAddress,
        firstPickupStation,
      ],
      [["customerName"], ["recipientName"], ["fullName"], ["receiverName"], ["name"], ["firstName"]],
    ) ?? null;

  const recipientPhone =
    pickNestedString(
      [
        rawOrder,
        payloadRecord,
        nestedPayloadData,
        firstItem,
        firstReceiver,
        firstCustomer,
        firstAddress,
        firstShippingAddress,
        firstPickupStation,
      ],
      [["customerPhone"], ["recipientPhone"], ["phone"], ["phoneNumber"], ["mobile"], ["phoneNo"]],
    ) ?? null;

  const recipientAddress =
    joinAddress([
      pickNestedString(
        [rawOrder, payloadRecord, nestedPayloadData, firstItem, firstAddress, firstShippingAddress, firstPickupStation],
        [["address1"], ["line1"], ["street"], ["address"], ["addressLine1"], ["stationName"]],
      ),
      pickNestedString(
        [rawOrder, payloadRecord, nestedPayloadData, firstItem, firstAddress, firstShippingAddress, firstPickupStation],
        [["address2"], ["line2"], ["addressLine2"]],
      ),
      pickNestedString(
        [rawOrder, payloadRecord, nestedPayloadData, firstItem, firstAddress, firstShippingAddress, firstPickupStation],
        [["city"], ["town"]],
      ),
      pickNestedString(
        [rawOrder, payloadRecord, nestedPayloadData, firstItem, firstAddress, firstShippingAddress, firstPickupStation],
        [["state"], ["county"], ["region"]],
      ),
      pickNestedString(
        [rawOrder, payloadRecord, nestedPayloadData, firstItem, firstAddress, firstShippingAddress, firstPickupStation],
        [["country"], ["countryName"]],
      ),
    ]) ?? null;

  const shipmentMethod =
    joinAddress([
      pickNestedString(
        [rawOrder, payloadRecord, nestedPayloadData, firstItem, firstShipping, firstShipment, firstDelivery, firstPickupStation],
        [["shipmentMethod"], ["shippingMethod"], ["type"], ["mode"], ["shippingType"], ["method"]],
      ),
      pickNestedString(
        [rawOrder, payloadRecord, nestedPayloadData, firstItem, firstShipping, firstShipment, firstDelivery, firstPickupStation],
        [["station"], ["stationName"], ["pickupStation"], ["name"]],
      ),
    ]) ?? null;

  const paymentMethod =
    readString(
      rawOrder.paymentMethod,
      rawOrder.payment_method,
      payloadRecord?.paymentMethod,
      payloadRecord?.payment_method,
      nestedPayloadData?.paymentMethod,
      nestedPayloadData?.payment_method,
    ) ?? null;
  const resolvedPaymentMethod =
    paymentMethod ??
    (coerceBoolean(rawOrder.isPrepayment) || coerceBoolean(payloadRecord?.isPrepayment) || coerceBoolean(nestedPayloadData?.isPrepayment)
      ? "Prepaid"
      : null);

  const shopName =
    readString(
      rawOrder.shopName,
      rawOrder.shop_label,
      payloadRecord?.shopName,
      nestedPayloadData?.shopName,
      firstItem?.shopName,
      firstProduct?.shopName,
      fallbackShopName,
    ) ?? null;

  const countryCode =
    readString(
      (rawOrder.country as any)?.code,
      (payloadRecord?.country as any)?.code,
      (nestedPayloadData?.country as any)?.code,
      (firstItem?.country as any)?.code,
      rawOrder.countryCode,
    ) ?? null;

  const totalAmountLocalCurrency =
    readString(
      rawOrder.totalAmountLocalCurrency,
      payloadRecord?.totalAmountLocalCurrency,
      (payloadRecord?.totalAmountLocal as any)?.currency,
      nestedPayloadData?.totalAmountLocalCurrency,
      (nestedPayloadData?.totalAmountLocal as any)?.currency,
      (firstItem?.totalAmountLocal as any)?.currency,
      (firstItem?.totalPriceLocal as any)?.currency,
      (firstItem?.paidPriceLocal as any)?.currency,
      (firstItem?.country as any)?.currencyCode,
    ) ?? null;

  let aggregatedAmount = 0;
  const normalizedItems = items.map((item, index) => {
    const product = isRecord(item.product) ? item.product : null;
    const quantity = Math.max(1, Math.trunc(readNumber(item.quantity, item.qty) ?? 1));
    const lineAmount =
      readNumber(
        item.totalAmountLocal,
        item.totalPriceLocal,
        item.subtotalLocal,
        item.paidPriceLocal,
        item.itemPriceLocal,
      ) ??
      ((readNumber(item.paidPrice, item.itemPrice, product?.priceLocal, product?.price) ?? 0) * quantity);
    aggregatedAmount += lineAmount;
    const sellerSku = readString(item.sellerSku, item.sellerSKU, item.sku, item.shopSku, product?.sellerSku, product?.sku);
    const productName = readString(item.productName, item.name, item.title, item.details, product?.name) ?? "Item";
    const productUrl =
      readString(item.productUrl, item.url, item.link, product?.url, product?.productUrl, product?.shareUrl) ??
      buildProductUrl(countryCode ?? undefined, sellerSku);
    const itemCurrency =
      readString(
        (item.totalAmountLocal as any)?.currency,
        (item.totalPriceLocal as any)?.currency,
        (item.paidPriceLocal as any)?.currency,
        (item.itemPriceLocal as any)?.currency,
        (item.country as any)?.currencyCode,
        totalAmountLocalCurrency,
      ) ?? "KES";

    const mergedRawPayload: Record<string, unknown> = {
      ...item,
      orderId: readString(rawOrder.number, rawOrder.id),
      orderNumber: readString(rawOrder.number, rawOrder.id),
      sellerSku,
      productName,
      productUrl,
      quantity,
      shopName,
      shipmentMethod,
      recipientName,
      recipientAddress,
      recipientPhone,
      paymentMethod,
      totalAmountLocal: {
        currency: itemCurrency,
        value: Number(lineAmount.toFixed(2)),
      },
      pickupStation: firstPickupStation ?? undefined,
      shipping: firstShipping ?? undefined,
      shipment: firstShipment ?? undefined,
      delivery: firstDelivery ?? undefined,
      address: firstAddress ?? undefined,
      shippingAddress: firstShippingAddress ?? undefined,
      receiver: firstReceiver ?? undefined,
      customer: firstCustomer ?? undefined,
      country: {
        ...(isRecord(item.country) ? item.country : {}),
        ...(countryCode ? { code: countryCode } : {}),
        currencyCode: itemCurrency,
      },
    };

    return {
      orderItemId: readString(item.id, item.orderItemId, item.skuId, item.productId) ?? `${readString(rawOrder.id, rawOrder.number) ?? "order"}:${index + 1}`,
      productName,
      productUrl,
      sellingPrice: Number(lineAmount.toFixed(2)),
      currency: itemCurrency,
      rawPayload: mergedRawPayload,
    };
  });

  const totalAmountLocalValue =
    readNumber(
      rawOrder.totalAmountLocalValue,
      rawOrder.totalAmountLocal,
      payloadRecord?.totalAmountLocalValue,
      payloadRecord?.totalAmountLocal,
      nestedPayloadData?.totalAmountLocalValue,
      nestedPayloadData?.totalAmountLocal,
    ) ??
    (aggregatedAmount > 0 ? Number(aggregatedAmount.toFixed(2)) : null);

  const totalItems =
    parseNullableInt(rawOrder.totalItems) ??
    (normalizedItems.length ? normalizedItems.reduce((sum, item) => sum + Math.max(1, Math.trunc(readNumber(item.rawPayload.quantity) ?? 1)), 0) : null);

  return {
    totalItems,
    totalAmountLocalCurrency,
    totalAmountLocalValue,
    recipientName,
    recipientAddress,
    recipientPhone,
    shipmentMethod,
    paymentMethod: resolvedPaymentMethod,
    shopName,
    countryCode,
    items: normalizedItems,
  };
}

export async function syncAllAccountsPendingOrders() {
  const startedAt = new Date();
  const accounts = await prisma.jumiaAccount.findMany({
    include: { shops: true },
  });

  if (!accounts.length) {
    const snapshot: PendingSnapshot = {
      ok: false,
      error: "no-jumia-accounts",
      startedAt: startedAt.toISOString(),
      completedAt: startedAt.toISOString(),
      tookMs: 0,
      windowDays: WINDOW_DAYS,
      pageSize: PAGE_SIZE,
      totalOrders: 0,
      totalPages: 0,
      shopCount: 0,
      accountCount: 0,
      perShop: [],
    };
    try {
      await writePendingSnapshot(snapshot);
    } catch (err) {
      console.error("[jumia.sync] pending snapshot persist failed (no accounts)", err);
    }
    return [];
  }

  const limiter = pLimit(LIMIT_RPS);
  const tasks: Array<Promise<SyncResult>> = [];

  for (const account of accounts) {
    const client = new JumiaClient(
      API_BASE,
      TOKEN_URL,
      account.clientId,
      account.refreshToken,
      async (rotated) => {
        await prisma.jumiaAccount.update({
          where: { id: account.id },
          data: { refreshToken: rotated },
        });
      }
    );

    // Discover shops for this account; try /shops first, then fall back to /shops-of-master-shop
    let remoteShops = await safeCall(() => client.getShops());
    // Debug: log shape summary
    try {
      const kind = Array.isArray(remoteShops)
        ? `array(len=${(remoteShops as any[]).length})`
        : remoteShops && typeof remoteShops === 'object'
        ? `object(keys=${Object.keys(remoteShops as Record<string, unknown>).join(',')})`
        : typeof remoteShops;
      console.log(`[jumia.sync] /shops shape: ${kind}`);
    } catch {}

    if (!(remoteShops as any)?.shops?.length && !Array.isArray(remoteShops)) {
      const alt = await safeCall(() => client.call<{ shops: { id: string; name: string }[] }>("/shops-of-master-shop"));
      if (alt?.shops?.length) remoteShops = alt;
    }
    const shopsArr = Array.isArray((remoteShops as any))
      ? ((remoteShops as any) as { id: string; name: string }[])
      : (remoteShops as any)?.shops || [];
    try {
      console.log(`[jumia.sync] shopsArr computed len=${Array.isArray(shopsArr) ? shopsArr.length : -1}`);
      if (Array.isArray(shopsArr) && shopsArr.length) {
        const s0 = shopsArr[0] as any;
        console.log(`[jumia.sync] sample shop fields: id=${String(s0?.id || s0?.shopId || s0?.sid || '')} name=${String(s0?.name || '')}`);
      }
    } catch {}
    const remoteIds = new Set<string>();
    if (Array.isArray(shopsArr) && shopsArr.length) {
      for (const shop of shopsArr) {
        if (shop?.id) remoteIds.add(String(shop.id));
        await prisma.jumiaShop.upsert({
          where: { id: shop.id },
          create: {
            id: shop.id,
            name: shop.name,
            accountId: account.id,
          },
          update: {
            name: shop.name,
            accountId: account.id,
          },
        });
      }
    } else {
      const sample = (() => {
        try { return JSON.stringify(remoteShops)?.slice(0, 200); } catch { return String(remoteShops); }
      })();
      console.warn(`[jumia.sync] no shops discovered for account id=${account.id} label="${account.label || ''}" body=${sample}`);
    }

    const whereShops: any = { accountId: account.id };
    if (remoteIds.size) whereShops.id = { in: Array.from(remoteIds) };

    if (remoteIds.size) {
      try {
        const pruned = await prisma.jumiaShop.deleteMany({
          where: {
            accountId: account.id,
            id: { notIn: Array.from(remoteIds) },
          },
        });
        if (pruned.count) {
          console.log(`[jumia.sync] pruned ${pruned.count} stale jumiaShop rows for account=${account.id}`);
        }
      } catch (err) {
        console.warn(`[jumia.sync] failed pruning stale shops for account=${account.id}`, err);
      }
    }

    const dbShops = await prisma.jumiaShop.findMany({
      where: whereShops,
      select: { id: true },
    });
    if (!dbShops.length) {
      console.warn(`[jumia.sync] zero shops in DB for account id=${account.id}; skipping orders sync for this account`);
    }

    for (const shop of dbShops) {
      tasks.push(
        limiter(() =>
          syncShopPending(client, account.id, shop.id, account.label ?? null).catch((error) => {
            console.error(`[jumia.sync] shop=${shop.id} error`, error);
            const message =
              error instanceof Error
                ? error.message
                : typeof error === "string"
                ? error
                : "unknown-error";
            const truncated = message.length > 180 ? `${message.slice(0, 177)}...` : message;
            return { shopId: shop.id, pages: 0, orders: 0, error: truncated };
          })
        )
      );
    }
  }

  const results = await Promise.all(tasks);
  const completedAt = new Date();
  // Compute a unique DB-backed count of pending orders for the same window to
  // avoid double-counting when the vendor returns the same order under
  // multiple shops (per-shop upsert counts can increment the same id several times).
  const totalOrders = await (async () => {
    try {
      const now = new Date();
      const windowStart = zonedTimeToUtc(addDays(now, -WINDOW_DAYS), DEFAULT_TIMEZONE);
      const count = await prisma.jumiaOrder.count({
        where: {
          status: { in: ['PENDING'] as any },
          OR: [
            { updatedAtJumia: { gte: windowStart } },
            { createdAtJumia: { gte: windowStart } },
            { AND: [{ updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: { gte: windowStart } }] },
          ],
        },
      });
      return count;
    } catch (err) {
      // Fall back to the aggregated per-shop sum if DB read fails for any reason
      return results.reduce((acc, r) => acc + (r?.orders || 0), 0);
    }
  })();
  const totalPages = results.reduce((acc, r) => acc + (r?.pages || 0), 0);
  const anyError = results.some((r) => r?.error);
  const shopCount = tasks.length;
  const snapshot: PendingSnapshot = {
    ok: shopCount > 0 && !anyError,
    error: shopCount === 0 ? "no-shops-synced" : anyError ? "partial-shop-errors" : null,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    tookMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    windowDays: WINDOW_DAYS,
    pageSize: PAGE_SIZE,
    totalOrders,
    totalPages,
    shopCount,
    accountCount: accounts.length,
    perShop: results.map((r) => ({
      shopId: r.shopId,
      orders: r.orders,
      pages: r.pages,
      error: r.error ?? null,
    })),
  };
  try {
    await writePendingSnapshot(snapshot);
  } catch (err) {
    console.error("[jumia.sync] pending snapshot persist failed", err);
  }
  return results;
}

async function syncShopPending(
  client: JumiaClient,
  jumiaAccountId: string,
  shopId: string,
  shopLabel: string | null,
): Promise<SyncResult> {
  const now = new Date();
  const start = zonedTimeToUtc(addDays(now, -WINDOW_DAYS), DEFAULT_TIMEZONE);
  const end = zonedTimeToUtc(now, DEFAULT_TIMEZONE);
  const formatTimestamp = (value: Date) => format(value, "yyyy-MM-dd HH:mm:ss");
  const marketplaceAccount = await prisma.marketplaceAccount.findUnique({
    where: {
      platform_jumiaShopSid: {
        platform: Platform.JUMIA,
        jumiaShopSid: shopId,
      },
    },
    select: { id: true, displayName: true },
  }).catch(() => null);

  let nextToken: string | undefined;
  const seenTokens = new Set<string>();
  let pages = 0;
  let ordersUpserted = 0;
  const MAX_PAGES = 2000; // hard safety cap to prevent infinite loops if vendor tokens misbehave

  do {
    const response = await client.getOrders({
      status: "PENDING",
      shopId,
      updatedAfter: formatTimestamp(start),
      updatedBefore: formatTimestamp(end),
      size: PAGE_SIZE,
      token: nextToken,
      sort: "ASC",
    });

    const orders = Array.isArray(response?.orders) ? response.orders : [];

    for (const order of orders) {
      await upsertOrder({
        client,
        jumiaAccountId,
        marketplaceAccountId: marketplaceAccount?.id ?? null,
        shopId,
        fallbackShopName: marketplaceAccount?.displayName ?? shopLabel,
        raw: order,
      });
      ordersUpserted += 1;
    }

    // Break conditions per vendor docs and extra safety:
    // - Stop when isLastPage flag is true
    // - Stop if nextToken is falsy
    // - Stop if nextToken repeats (stale token) to avoid infinite loops
    const nxt = (response as any)?.nextToken ?? null;
    const lastFlag = (response as any)?.isLastPage === true;
    pages += 1;
    if (lastFlag) {
      nextToken = undefined;
      break;
    }
    if (!nxt || typeof nxt !== 'string' || !nxt.trim()) {
      nextToken = undefined;
      break;
    }
    if (seenTokens.has(String(nxt))) {
      // token repeated — vendor likely returned the same page token; stop to prevent loop
      nextToken = undefined;
      break;
    }
    seenTokens.add(String(nxt));
    nextToken = String(nxt);
  } while (nextToken && pages < MAX_PAGES);

  await prisma.jumiaShop.update({
    where: { id: shopId },
    data: { lastOrdersUpdatedBefore: end },
  });

  return { shopId, pages, orders: ordersUpserted };
}

async function upsertOrder(opts: {
  client: JumiaClient;
  jumiaAccountId: string;
  marketplaceAccountId: string | null;
  shopId: string;
  fallbackShopName: string | null;
  raw: any;
}) {
  const { client, jumiaAccountId, marketplaceAccountId, shopId, fallbackShopName, raw } = opts;
  const status = raw?.hasMultipleStatus
    ? "MULTIPLE"
    : typeof raw?.status === "string" && raw.status.trim()
    ? raw.status
    : "UNKNOWN";

  const id = String(raw?.id ?? raw?.orderId ?? raw?.order_id ?? "");
  if (!id) {
    throw new Error("Missing order id in Jumia payload");
  }

  const orderNumber = readString(raw?.number, raw?.id) ?? id;
  traceHydration(orderNumber, "header received", {
    id,
    number: orderNumber,
    shopId,
    status,
    totalItems: parseNullableInt(raw?.totalItems),
    totalAmountLocalValue: readNumber(raw?.totalAmountLocalValue, raw?.totalAmountLocal),
  });

  const detailPayload = await fetchOrderItemsPayload(client, raw as Record<string, unknown>);
  traceHydration(orderNumber, "detail/items fetched", {
    resolvedOrderId: detailPayload.resolvedOrderId,
    itemsFetched: detailPayload.items.length,
  });

  const hydrated = hydratePendingOrderDetails(
    raw as Record<string, unknown>,
    detailPayload.payload,
    detailPayload.items,
    readString(
      raw?.shop?.name,
      raw?.shopName,
      raw?.shop_label,
      fallbackShopName,
    ) ?? null,
  );

  traceHydration(orderNumber, "recipient saved", {
    recipientName: hydrated.recipientName,
    recipientPhone: hydrated.recipientPhone,
  });
  traceHydration(orderNumber, "address saved", {
    recipientAddress: hydrated.recipientAddress,
    shipmentMethod: hydrated.shipmentMethod,
  });
  traceHydration(orderNumber, "item count saved", {
    totalItems: hydrated.totalItems,
    itemRows: hydrated.items.length,
  });
  traceHydration(orderNumber, "amount saved", {
    currency: hydrated.totalAmountLocalCurrency,
    totalAmountLocalValue: hydrated.totalAmountLocalValue,
  });

  await prisma.jumiaOrder.upsert({
    where: { id },
    create: {
      id,
      number: parseNullableInt(raw?.number),
      status,
      hasMultipleStatus: Boolean(raw?.hasMultipleStatus),
      pendingSince: isNonEmptyString(raw?.pendingSince) ? String(raw.pendingSince) : null,
      totalItems: hydrated.totalItems ?? parseNullableInt(raw?.totalItems),
      packedItems: parseNullableInt(raw?.packedItems),
      countryCode: hydrated.countryCode ?? (isNonEmptyString(raw?.country?.code) ? String(raw.country.code) : null),
      isPrepayment: coerceBoolean(raw?.isPrepayment),
      totalAmountLocalCurrency:
        hydrated.totalAmountLocalCurrency ??
        (typeof raw?.totalAmountLocalCurrency === "string" ? String(raw.totalAmountLocalCurrency) : null),
      totalAmountLocalValue:
        hydrated.totalAmountLocalValue ??
        (() => {
          const v = raw?.totalAmountLocalValue ?? raw?.totalAmountLocal;
          return typeof v === "number" && Number.isFinite(v) ? v : null;
        })(),
      createdAtJumia: parseOptionalDate(raw?.createdAt),
      updatedAtJumia: parseOptionalDate(raw?.updatedAt),
      shopId,
      shopName:
        hydrated.shopName ??
        ((raw?.shop && typeof raw.shop === "object" && raw.shop.name)
          ? String(raw.shop.name)
          : (typeof raw?.shopName === "string" ? raw.shopName : typeof raw?.shop_label === "string" ? raw.shop_label : fallbackShopName)),
    },
    update: {
      number: parseNullableInt(raw?.number),
      status,
      hasMultipleStatus: Boolean(raw?.hasMultipleStatus),
      pendingSince: isNonEmptyString(raw?.pendingSince) ? String(raw.pendingSince) : null,
      totalItems: hydrated.totalItems ?? parseNullableInt(raw?.totalItems),
      packedItems: parseNullableInt(raw?.packedItems),
      countryCode: hydrated.countryCode ?? (isNonEmptyString(raw?.country?.code) ? String(raw.country.code) : null),
      isPrepayment: coerceBoolean(raw?.isPrepayment),
      totalAmountLocalCurrency:
        hydrated.totalAmountLocalCurrency ??
        (typeof raw?.totalAmountLocalCurrency === "string" ? String(raw.totalAmountLocalCurrency) : null),
      totalAmountLocalValue:
        hydrated.totalAmountLocalValue ??
        (() => {
          const v = raw?.totalAmountLocalValue ?? raw?.totalAmountLocal;
          return typeof v === "number" && Number.isFinite(v) ? v : null;
        })(),
      createdAtJumia: parseOptionalDate(raw?.createdAt),
      updatedAtJumia: parseOptionalDate(raw?.updatedAt),
      shopName:
        hydrated.shopName ??
        ((raw?.shop && typeof raw.shop === "object" && raw.shop.name)
          ? String(raw.shop.name)
          : (typeof raw?.shopName === "string" ? raw.shopName : typeof raw?.shop_label === "string" ? raw.shop_label : fallbackShopName ?? undefined)),
    },
  });

  if (!marketplaceAccountId || !hydrated.items.length) return;

  const currentOrderItemIds = hydrated.items.map((item) => item.orderItemId);
  await prisma.marketplaceOrder.deleteMany({
    where: {
      accountId: marketplaceAccountId,
      platform: Platform.JUMIA,
      orderId: orderNumber,
      orderItemId: { notIn: currentOrderItemIds },
    },
  }).catch(() => null);

  for (const item of hydrated.items) {
    await prisma.marketplaceOrder.upsert({
      where: {
        platform_orderItemId: {
          platform: Platform.JUMIA,
          orderItemId: item.orderItemId,
        },
      },
      create: {
        accountId: marketplaceAccountId,
        platform: Platform.JUMIA,
        orderId: orderNumber,
        orderItemId: item.orderItemId,
        status,
        orderedAt: parseOptionalDate(raw?.createdAt) ?? new Date(),
        productName: item.productName,
        productUrl: item.productUrl ?? null,
        sellingPrice: item.sellingPrice,
        currency: item.currency,
        rawPayload: item.rawPayload as any,
      },
      update: {
        status,
        orderedAt: parseOptionalDate(raw?.createdAt) ?? new Date(),
        productName: item.productName,
        productUrl: item.productUrl ?? undefined,
        sellingPrice: item.sellingPrice,
        currency: item.currency,
        rawPayload: item.rawPayload as any,
      },
    });
  }
}

function parseNullableInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function coerceBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return null;
}

async function safeCall<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    console.error("[jumia.sync] fetch error", error);
    return undefined;
  }
}
