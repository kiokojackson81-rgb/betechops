import { prisma } from "@/lib/prisma";
import { JumiaClient } from "@/lib/jumia/client";
// Lightweight in-file concurrency limiter to avoid bundling issues with p-limit
function createLimiter<T>(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    active--;
    const fn = queue.shift();
    if (fn) fn();
  };

  return async (task: () => Promise<T>): Promise<T> => {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      next();
    }
  };
}
import { addDays, format } from "date-fns";
import { zonedTimeToUtc } from "date-fns-tz";

const API_BASE = "https://vendor-api.jumia.com";
const TOKEN_URL = "https://vendor-api.jumia.com/token";
const LIMIT_RPS = 4;
const WINDOW_DAYS = 2;
const PAGE_SIZE = 300;
const DEFAULT_TIMEZONE = "Africa/Nairobi";

type SyncResult = {
  shopId: string;
  orders: number;
  pages: number;
};

export async function syncAllAccountsPendingOrders() {
  const accounts = await prisma.jumiaAccount.findMany({
    include: { shops: true },
  });

  if (!accounts.length) {
    return [];
  }

  const limiter = createLimiter<SyncResult>(LIMIT_RPS);
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

    const remoteShops = await safeCall(() => client.getShops());
    if (remoteShops?.shops?.length) {
      for (const shop of remoteShops.shops) {
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
    }

    const dbShops = await prisma.jumiaShop.findMany({
      where: { accountId: account.id },
      select: { id: true },
    });

    for (const shop of dbShops) {
      tasks.push(
        limiter(() => syncShopPending(client, shop.id).catch((error) => {
          console.error(`[jumia.sync] shop=${shop.id} error`, error);
          return { shopId: shop.id, pages: 0, orders: 0 };
        }))
      );
    }
  }

  const results = await Promise.all(tasks);
  return results;
}

async function syncShopPending(client: JumiaClient, shopId: string): Promise<SyncResult> {
  const now = new Date();
  const start = zonedTimeToUtc(addDays(now, -WINDOW_DAYS), DEFAULT_TIMEZONE);
  const end = zonedTimeToUtc(now, DEFAULT_TIMEZONE);
  const formatTimestamp = (value: Date) => format(value, "yyyy-MM-dd HH:mm:ss");

  let nextToken: string | undefined;
  let pages = 0;
  let ordersUpserted = 0;

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

    nextToken = response?.nextToken || undefined;
    pages += 1;
  } while (nextToken);

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
