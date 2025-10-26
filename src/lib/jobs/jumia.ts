/**
 * Jumia jobs placed under `src/lib/jobs` to match repository layout.
 * - Optional Redis-backed idempotency store with in-memory fallback.
 * - Optional label upload to S3 when `JUMIA_LABEL_BUCKET` is set.
 * - Exports `fulfillOrder` and `syncOrders`.
 */

import { jumiaFetch, jumiaPaginator } from '../jumia';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../log';
import { prisma } from '../prisma';
import { incOrdersProcessed, incOrderHandlerErrors, incFulfillments, incFulfillmentFailures, observeFulfillmentLatency } from '../metrics';

type RedisClientLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttl?: number): Promise<'OK' | null> | Promise<void>;
};

let _redis: RedisClientLike | null | undefined;
const _memStore = new Map<string, any>();

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
  } catch (err) {
    _redis = null;
    return null;
  }
}

async function idempotencyGet(key: string): Promise<any | null> {
  const r = await ensureRedisClient();
  if (r) {
    try {
      const v = await r.get(key);
      return v ? JSON.parse(v) : null;
    } catch (_) {
      return null;
    }
  }
  return _memStore.has(key) ? _memStore.get(key) : null;
}

async function idempotencySet(key: string, value: any, ttlSeconds = 60 * 60 * 24 * 7): Promise<void> {
  const r = await ensureRedisClient();
  const payload = JSON.stringify(value);
  if (r) {
    try {
      await (r as any).set(key, payload, 'EX', ttlSeconds);
      return;
    } catch (_) {
      // fall through to mem
    }
  }
  _memStore.set(key, value);
  setTimeout(() => _memStore.delete(key), ttlSeconds * 1000).unref?.();
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

  const res = await jumiaFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });

  let payload: any;
  try {
    payload = await res.json();
  } catch (err) {
    payload = { ok: res.ok, status: res.status, text: await res.text?.() };
  }

  // If the API returned a label as base64, persist to S3 when configured.
  try {
    if (payload?.labelBase64 && typeof payload.labelBase64 === 'string') {
      const buf = Buffer.from(payload.labelBase64, 'base64');
      const filename = payload.labelFilename || `${orderId}.pdf`;
      const info = await uploadLabelToS3(shopId, orderId, filename, buf);
      if (info) payload._labelStored = info;
    }
  } catch (err) {
    // non-fatal — continue
    logger.warn({ shopId, orderId, err }, 'label upload failed');
  }

  const startTs = Date.now();
  const toStore = { status: res.status, ok: res.ok, payload, ts: Date.now() };
  try {
    await idempotencySet(key, toStore, opts?.ttlSeconds ?? 60 * 60 * 24 * 7);
  } catch (err) {
    logger.warn({ key, err }, 'idempotency set failed');
  }

  const took = Date.now() - startTs;
  incFulfillments(1);
  if (!res.ok) incFulfillmentFailures(1);
  observeFulfillmentLatency(took);
  // persist audit to DB (best-effort)
    try {
      await prisma.fulfillmentAudit.create({
        data: {
          idempotencyKey: key,
          shopId,
          orderId,
          action: 'FULFILL',
          status: res.status,
          ok: Boolean(res.ok),
          payload: toStore.payload,
          s3Bucket: (toStore.payload?._labelStored as any)?.bucket ?? null,
          s3Key: (toStore.payload?._labelStored as any)?.key ?? null,
        },
      });
    } catch (err) {
    logger.warn({ err, shopId, orderId }, 'failed to persist FulfillmentAudit');
  }

  logger.info({ shopId, orderId, status: res.status, durationMs: took }, 'fulfillOrder completed');
  return toStore;
}

/**
 * Iterate orders for a shop and call the provided handler for each order.
 * The handler can be async. Returns the number of orders processed.
 */
export async function syncOrders(shopId: string, handler: (order: any) => Promise<void> | void, params?: Record<string, any>) {
  const pageParams = { shopId, status: params?.status ?? 'PENDING', pageSize: params?.pageSize ?? 50 };
  let processed = 0;
  for await (const page of jumiaPaginator('/orders', pageParams)) {
    const orders = Array.isArray(page?.data) ? page.data : page?.orders ?? [];
    for (const o of orders) {
      try {
        await handler(o);
        processed += 1;
        incOrdersProcessed(1);
      } catch (err) {
        // swallow: job runner should implement retries/alerts; keep this safe
        incOrderHandlerErrors(1);
        logger.error({ shopId, orderId: o?.id ?? null, err }, 'syncOrders handler error for order');
      }
    }
  }
  return processed;
}

export default {
  fulfillOrder,
  syncOrders,
};
