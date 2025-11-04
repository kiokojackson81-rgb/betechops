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
// Make this configurable via env JUMIA_PENDING_WINDOW_DAYS, defaulting to 30 days.
// Set to a larger value (e.g., 90) if you observe older pendings in vendor.
const WINDOW_DAYS = Number(process.env.JUMIA_PENDING_WINDOW_DAYS || 30);
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
          syncShopPending(client, shop.id).catch((error) => {
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
  const totalOrders = results.reduce((acc, r) => acc + (r?.orders || 0), 0);
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

async function syncShopPending(client: JumiaClient, shopId: string): Promise<SyncResult> {
  const now = new Date();
  const start = zonedTimeToUtc(addDays(now, -WINDOW_DAYS), DEFAULT_TIMEZONE);
  const end = zonedTimeToUtc(now, DEFAULT_TIMEZONE);
  const formatTimestamp = (value: Date) => format(value, "yyyy-MM-dd HH:mm:ss");

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
      await upsertOrder(shopId, order);
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

async function upsertOrder(shopId: string, raw: any) {
  const status = raw?.hasMultipleStatus
    ? "MULTIPLE"
    : typeof raw?.status === "string" && raw.status.trim()
    ? raw.status
    : "UNKNOWN";

  const id = String(raw?.id ?? raw?.orderId ?? raw?.order_id ?? "");
  if (!id) {
    throw new Error("Missing order id in Jumia payload");
  }

  await prisma.jumiaOrder.upsert({
    where: { id },
    create: {
      id,
      number: parseNullableInt(raw?.number),
      status,
      hasMultipleStatus: Boolean(raw?.hasMultipleStatus),
      pendingSince: isNonEmptyString(raw?.pendingSince) ? String(raw.pendingSince) : null,
      totalItems: parseNullableInt(raw?.totalItems),
      packedItems: parseNullableInt(raw?.packedItems),
      countryCode: isNonEmptyString(raw?.country?.code) ? String(raw.country.code) : null,
      isPrepayment: coerceBoolean(raw?.isPrepayment),
      createdAtJumia: parseOptionalDate(raw?.createdAt),
      updatedAtJumia: parseOptionalDate(raw?.updatedAt),
      shopId,
    },
    update: {
      number: parseNullableInt(raw?.number),
      status,
      hasMultipleStatus: Boolean(raw?.hasMultipleStatus),
      pendingSince: isNonEmptyString(raw?.pendingSince) ? String(raw.pendingSince) : null,
      totalItems: parseNullableInt(raw?.totalItems),
      packedItems: parseNullableInt(raw?.packedItems),
      countryCode: isNonEmptyString(raw?.country?.code) ? String(raw.country.code) : null,
      isPrepayment: coerceBoolean(raw?.isPrepayment),
      createdAtJumia: parseOptionalDate(raw?.createdAt),
      updatedAtJumia: parseOptionalDate(raw?.updatedAt),
    },
  });
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
