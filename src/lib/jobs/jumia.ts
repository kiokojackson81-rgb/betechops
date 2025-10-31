/**
 * Jumia jobs placed under `src/lib/jobs` to match repository layout.
 * - Optional Redis-backed idempotency store with in-memory fallback.
 * - Optional label upload to S3 when `JUMIA_LABEL_BUCKET` is set.
 * - Exports `fulfillOrder` and `syncOrders`.
 */

import { jumiaFetch, jumiaPaginator, loadShopAuthById } from '../jumia';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../log';
import { prisma } from '../prisma';
import { incOrdersProcessed, incOrderHandlerErrors, incFulfillments, incFulfillmentFailures, observeFulfillmentLatency } from '../metrics';
import { normalizeFromJumia } from '../connectors/normalize';
import { upsertNormalizedOrder, ensureReturnCaseForOrder } from '../sync/upsertOrder';
import type { Prisma } from '@prisma/client';
import { Platform } from '@prisma/client';

type RedisClientLike = {
  get(key: string): Promise<string | null>;
  set(...args: unknown[]): Promise<unknown>;
};

let _redis: RedisClientLike | null | undefined;
const _memStore = new Map<string, unknown>();

async function ensureRedisClient(): Promise<RedisClientLike | null> {
  if (_redis !== undefined) return _redis ?? null;
  const url = process.env.REDIS_URL;
  if (!url) {
    _redis = null;
    return null;
  }
  try {
    const IORedis = (await import('ioredis')).default;
    const client = new IORedis(url);
    await client.ping();
    _redis = client as unknown as RedisClientLike;
    return _redis;
  } catch {
    _redis = null;
    return null;
  }
}

async function idempotencyGet(key: string): Promise<unknown | null> {
  const r = await ensureRedisClient();
  if (r) {
    try {
      const v = await r.get(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  }
  return _memStore.has(key) ? _memStore.get(key) ?? null : null;
}
async function idempotencySet(key: string, value: unknown, ttlSeconds = 60 * 60 * 24 * 7): Promise<void> {
  const r = await ensureRedisClient();
  const payload = JSON.stringify(value);
  if (r) {
    try {
      await r.set(key, payload, 'EX', ttlSeconds);
      return;
    } catch {
      // fall through to mem
    }
  }
  _memStore.set(key, value);
  // In tests, avoid long-lived timers that can cause Jest to hang
  if (process.env.NODE_ENV !== 'test') {
    setTimeout(() => _memStore.delete(key), ttlSeconds * 1000).unref?.();
  }
}

function s3Client(): S3Client | null {
  const bucket = process.env.JUMIA_LABEL_BUCKET;
  if (!bucket) return null;
  return new S3Client({});
}

async function uploadLabelToS3(shopId: string, orderId: string, filename: string, buf: Buffer) {
  const bucket = process.env.JUMIA_LABEL_BUCKET;
  if (!bucket) return null;
  const client = s3Client();
  if (!client) return null;
  const key = `labels/${shopId}/${orderId}/${Date.now()}_${filename}`;
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: buf });
  await client.send(cmd);
  return { bucket, key };
}

/**
 * Try to fulfill an order on Jumia. Idempotent by key: `fulfill:{shopId}:{orderId}`.
 * Returns the raw fulfillment response from Jumia or the stored idempotent value.
 */
export async function fulfillOrder(shopId: string, orderId: string, opts?: { ttlSeconds?: number }) {
  const key = `fulfill:${shopId}:${orderId}`;
  const existing = await idempotencyGet(key);
  if (existing) return existing;

  const path = process.env.JUMIA_FULFILL_ENDPOINT || `/orders/fulfill?orderId=${encodeURIComponent(orderId)}`;

  const res = (await jumiaFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
    rawResponse: true,
  })) as Response;

  let payload: unknown;
  try {
    // some jumia endpoints return JSON, others return text - attempt json() first
    payload = await res.clone().json();
  } catch {
    const text = await res.text().catch(() => '');
    payload = text ? { text } : {};
  }

  // If the API returned a label as base64, persist to S3 when configured.
  try {
      // payload is unknown; narrow to Record for label checks
      if (payload && typeof payload === 'object') {
        const pRec = payload as Record<string, unknown>;
        if (typeof pRec.labelBase64 === 'string') {
          const buf = Buffer.from(pRec.labelBase64, 'base64');
          const filename = (typeof pRec.labelFilename === 'string' ? pRec.labelFilename : `${orderId}.pdf`);
          const info = await uploadLabelToS3(shopId, orderId, filename, buf);
          if (info) (pRec as Record<string, unknown>)._labelStored = info;
        }
      }
  } catch (err) {
    // non-fatal — continue
    logger.warn({ shopId, orderId, err }, 'label upload failed');
  }

  const startTs = Date.now();
  const toStore = { status: res.status, ok: res.ok, payload, ts: Date.now() };
    try {
      await idempotencySet(key, toStore, opts?.ttlSeconds ?? 60 * 60 * 24 * 7);
    } catch {
      logger.warn({ key }, 'idempotency set failed');
    }

  const took = Date.now() - startTs;
  incFulfillments(1);
  if (!res.ok) incFulfillmentFailures(1);
  observeFulfillmentLatency(took);
  // persist audit to DB (best-effort)
      try {
        // Prisma JSON fields expect a serializable value; coerce safely by serializing
        const payloadForDb = toStore.payload as unknown;
        let s3Bucket: string | null = null;
        let s3Key: string | null = null;
        if (payloadForDb && typeof payloadForDb === 'object') {
          const pRec = payloadForDb as Record<string, unknown>;
          const stored = pRec._labelStored as Record<string, unknown> | undefined;
          if (stored) {
            s3Bucket = typeof stored.bucket === 'string' ? stored.bucket : null;
            s3Key = typeof stored.key === 'string' ? stored.key : null;
          }
        }
        await prisma.fulfillmentAudit.create({
          data: {
            idempotencyKey: key,
            shopId,
            orderId,
            action: 'FULFILL',
            status: res.status,
            ok: Boolean(res.ok),
            payload: JSON.parse(JSON.stringify(payloadForDb)),
            s3Bucket,
            s3Key,
          },
        });
      } catch {
        logger.warn({ shopId, orderId }, 'failed to persist FulfillmentAudit');
      }

  logger.info({ shopId, orderId, status: res.status, durationMs: took }, 'fulfillOrder completed');
  return toStore;
}

/**
 * Iterate orders for a shop and call the provided handler for each order.
 * The handler can be async. Returns the number of orders processed.
 */
export async function syncOrders(shopId: string, handler: (order: unknown) => Promise<void> | void, params?: Record<string, unknown>) {
  const pageParams: Record<string, string> = {
    shopId,
    status: String(params?.status ?? 'PENDING'),
    pageSize: String(params?.pageSize ?? 50),
  };
  let processed = 0;
  for await (const page of jumiaPaginator('/orders', pageParams)) {
    // page is unknown from the paginator; narrow before accessing fields
    let orders: unknown[] = [];
    if (page && typeof page === 'object') {
      const pRec = page as Record<string, unknown>;
      if (Array.isArray(pRec.data)) orders = pRec.data as unknown[];
      else if (Array.isArray(pRec.orders)) orders = pRec.orders as unknown[];
      else if (Array.isArray(pRec.items)) orders = pRec.items as unknown[];
    }
    for (const o of orders) {
      try {
        await handler(o);
        processed += 1;
        incOrdersProcessed(1);
      } catch (handlerErr) {
        // swallow: job runner should implement retries/alerts; keep this safe
        incOrderHandlerErrors(1);
  const orderIdVal = o && typeof o === 'object' && 'id' in (o as Record<string, unknown>) ? String((o as Record<string, unknown>).id) : null;
  logger.error({ shopId, orderId: orderIdVal, err: handlerErr }, 'syncOrders handler error for order');
      }
    }
  }
  return processed;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function pickLatest(current: string | null, next: string | null) {
  if (!next) return current;
  if (!current) return next;
  return new Date(next).getTime() > new Date(current).getTime() ? next : current;
}

export async function syncReturnOrders(opts?: { shopId?: string; lookbackDays?: number }) {
  // Narrow shopId to non-null in the truthy branch to satisfy Prisma.ShopWhereInput
  const shopFilter: Prisma.ShopWhereInput = opts?.shopId
    ? { id: opts.shopId! }
    : { platform: Platform.JUMIA, isActive: true };
  const shops = await prisma.shop.findMany({ where: shopFilter, select: { id: true } });
  const summary: Record<string, { processed: number; returnCases: number; cursor?: string }> = {};

  for (const shop of shops) {
    const shopId = shop.id;
    const configKey = `jumia:return:${shopId}:cursor`;
    const cfg = await prisma.config.findUnique({ where: { key: configKey } }).catch(() => null);
    const updatedAfterCfg = (cfg?.json as { updatedAfter?: string } | null)?.updatedAfter;
    let updatedAfter = updatedAfterCfg;
    if (!updatedAfter) {
      const lookbackDays = opts?.lookbackDays ?? 14;
      const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
      updatedAfter = from.toISOString();
    }

    const shopAuth = await loadShopAuthById(shopId).catch(() => undefined);
    const fetcher = (path: string) => jumiaFetch(path, shopAuth ? ({ shopAuth } as any) : ({} as any));
    const params: Record<string, string> = { status: 'RETURNED,FAILED', size: '50' };
    if (updatedAfter) params.updatedAfter = updatedAfter;

    let processed = 0;
    let ensured = 0;
    let latestCursor: string | null = updatedAfterCfg ?? null;

    try {
      for await (const page of jumiaPaginator('/orders', params, fetcher)) {
        const arr = Array.isArray((page as any)?.orders)
          ? (page as any).orders
          : Array.isArray((page as any)?.items)
          ? (page as any).items
          : Array.isArray((page as any)?.data)
          ? (page as any).data
          : [];
        for (const raw of arr) {
          processed += 1;
          const rawObj = (raw || {}) as Record<string, unknown>;
          if (!rawObj.id) continue;
          if (!Array.isArray(rawObj.items) || rawObj.items.length === 0) {
            try {
              const itemsResp = await jumiaFetch(`/orders/items?orderId=${encodeURIComponent(String(rawObj.id))}`, shopAuth ? ({ shopAuth } as any) : ({} as any));
              if (itemsResp && typeof itemsResp === 'object' && Array.isArray((itemsResp as any).items)) {
                rawObj.items = (itemsResp as any).items;
              }
            } catch (e) {
              logger.warn({ shopId, orderId: rawObj.id, err: e }, 'failed to load order items for return sync');
            }
          }
          const normalized = normalizeFromJumia(rawObj, shopId);
          const upserted = await upsertNormalizedOrder(normalized);
          const orderRecord = upserted.order
            ?? (await prisma.order.findUnique({ where: { id: upserted.orderId }, select: { id: true, shopId: true } }));
          if (!orderRecord) continue;
          const createdAtVendor = toIso(rawObj.createdAt ?? rawObj.created_at);
          const ensuredId = await ensureReturnCaseForOrder({
            orderId: orderRecord.id,
            shopId: orderRecord.shopId,
            vendorStatus: normalized.status,
            reasonCode: normalized.status,
            vendorCreatedAt: createdAtVendor,
            picked: false,
          });
          if (ensuredId) ensured += 1;
          latestCursor = pickLatest(latestCursor, toIso(rawObj.updatedAt ?? rawObj.updated_at ?? rawObj.lastUpdatedAt));
        }
      }
    } catch (err) {
      logger.error({ shopId, err }, 'syncReturnOrders failed for shop');
    }

    if (latestCursor && latestCursor !== updatedAfterCfg) {
      await prisma.config.upsert({
        where: { key: configKey },
        update: { json: { updatedAfter: latestCursor } },
        create: { key: configKey, json: { updatedAfter: latestCursor } },
      }).catch(() => null);
    }

    summary[shopId] = { processed, returnCases: ensured, cursor: latestCursor ?? undefined };
  }

  return summary;
}

const jobs = {
  fulfillOrder,
  syncOrders,
  syncReturnOrders,
};

export default jobs;
