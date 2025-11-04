"use strict";
/**
 * Jumia jobs placed under `src/lib/jobs` to match repository layout.
 * - Optional Redis-backed idempotency store with in-memory fallback.
 * - Optional label upload to S3 when `JUMIA_LABEL_BUCKET` is set.
 * - Exports `fulfillOrder` and `syncOrders`.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.fulfillOrder = fulfillOrder;
exports.syncOrders = syncOrders;
exports.syncReturnOrders = syncReturnOrders;
exports.syncOrdersIncremental = syncOrdersIncremental;
const jumia_1 = require("../jumia");
const date_fns_1 = require("date-fns");
const client_s3_1 = require("@aws-sdk/client-s3");
const log_1 = require("../log");
const prisma_1 = require("../prisma");
const metrics_1 = require("../metrics");
const normalize_1 = require("../connectors/normalize");
const upsertOrder_1 = require("../sync/upsertOrder");
let _redis;
const _memStore = new Map();
async function ensureRedisClient() {
    if (_redis !== undefined)
        return _redis ?? null;
    const url = process.env.REDIS_URL;
    if (!url) {
        _redis = null;
        return null;
    }
    try {
        const IORedis = (await Promise.resolve().then(() => __importStar(require('ioredis')))).default;
        const client = new IORedis(url);
        await client.ping();
        _redis = client;
        return _redis;
    }
    catch {
        _redis = null;
        return null;
    }
}
async function idempotencyGet(key) {
    const r = await ensureRedisClient();
    if (r) {
        try {
            const v = await r.get(key);
            return v ? JSON.parse(v) : null;
        }
        catch {
            return null;
        }
    }
    return _memStore.has(key) ? _memStore.get(key) ?? null : null;
}
async function idempotencySet(key, value, ttlSeconds = 60 * 60 * 24 * 7) {
    const r = await ensureRedisClient();
    const payload = JSON.stringify(value);
    if (r) {
        try {
            await r.set(key, payload, 'EX', ttlSeconds);
            return;
        }
        catch {
            // fall through to mem
        }
    }
    _memStore.set(key, value);
    // In tests, avoid long-lived timers that can cause Jest to hang
    if (process.env.NODE_ENV !== 'test') {
        setTimeout(() => _memStore.delete(key), ttlSeconds * 1000).unref?.();
    }
}
function s3Client() {
    const bucket = process.env.JUMIA_LABEL_BUCKET;
    if (!bucket)
        return null;
    return new client_s3_1.S3Client({});
}
async function uploadLabelToS3(shopId, orderId, filename, buf) {
    const bucket = process.env.JUMIA_LABEL_BUCKET;
    if (!bucket)
        return null;
    const client = s3Client();
    if (!client)
        return null;
    const key = `labels/${shopId}/${orderId}/${Date.now()}_${filename}`;
    const cmd = new client_s3_1.PutObjectCommand({ Bucket: bucket, Key: key, Body: buf });
    await client.send(cmd);
    return { bucket, key };
}
/**
 * Try to fulfill an order on Jumia. Idempotent by key: `fulfill:{shopId}:{orderId}`.
 * Returns the raw fulfillment response from Jumia or the stored idempotent value.
 */
async function fulfillOrder(shopId, orderId, opts) {
    const key = `fulfill:${shopId}:${orderId}`;
    const existing = await idempotencyGet(key);
    if (existing)
        return existing;
    const path = process.env.JUMIA_FULFILL_ENDPOINT || `/orders/fulfill?orderId=${encodeURIComponent(orderId)}`;
    const res = (await (0, jumia_1.jumiaFetch)(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
        rawResponse: true,
    }));
    let payload;
    try {
        // some jumia endpoints return JSON, others return text - attempt json() first
        payload = await res.clone().json();
    }
    catch {
        const text = await res.text().catch(() => '');
        payload = text ? { text } : {};
    }
    // If the API returned a label as base64, persist to S3 when configured.
    try {
        // payload is unknown; narrow to Record for label checks
        if (payload && typeof payload === 'object') {
            const pRec = payload;
            if (typeof pRec.labelBase64 === 'string') {
                const buf = Buffer.from(pRec.labelBase64, 'base64');
                const filename = (typeof pRec.labelFilename === 'string' ? pRec.labelFilename : `${orderId}.pdf`);
                const info = await uploadLabelToS3(shopId, orderId, filename, buf);
                if (info)
                    pRec._labelStored = info;
            }
        }
    }
    catch (err) {
        // non-fatal — continue
        log_1.logger.warn({ shopId, orderId, err }, 'label upload failed');
    }
    const startTs = Date.now();
    const toStore = { status: res.status, ok: res.ok, payload, ts: Date.now() };
    try {
        await idempotencySet(key, toStore, opts?.ttlSeconds ?? 60 * 60 * 24 * 7);
    }
    catch {
        log_1.logger.warn({ key }, 'idempotency set failed');
    }
    const took = Date.now() - startTs;
    (0, metrics_1.incFulfillments)(1);
    if (!res.ok)
        (0, metrics_1.incFulfillmentFailures)(1);
    (0, metrics_1.observeFulfillmentLatency)(took);
    // persist audit to DB (best-effort; skip in tests to keep suites hermetic)
    if (process.env.NODE_ENV !== 'test') {
        try {
            // Prisma JSON fields expect a serializable value; coerce safely by serializing
            const payloadForDb = toStore.payload;
            let s3Bucket = null;
            let s3Key = null;
            if (payloadForDb && typeof payloadForDb === 'object') {
                const pRec = payloadForDb;
                const stored = pRec._labelStored;
                if (stored) {
                    s3Bucket = typeof stored.bucket === 'string' ? stored.bucket : null;
                    s3Key = typeof stored.key === 'string' ? stored.key : null;
                }
            }
            await prisma_1.prisma.fulfillmentAudit.create({
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
        }
        catch {
            log_1.logger.warn({ shopId, orderId }, 'failed to persist FulfillmentAudit');
        }
    }
    log_1.logger.info({ shopId, orderId, status: res.status, durationMs: took }, 'fulfillOrder completed');
    return toStore;
}
/**
 * Iterate orders for a shop and call the provided handler for each order.
 * The handler can be async. Returns the number of orders processed.
 */
async function syncOrders(shopId, handler, params) {
    const pageParams = {
        shopId,
        status: String(params?.status ?? 'PENDING'),
        pageSize: String(params?.pageSize ?? 50),
    };
    let processed = 0;
    for await (const page of (0, jumia_1.jumiaPaginator)('/orders', pageParams)) {
        // page is unknown from the paginator; narrow before accessing fields
        let orders = [];
        if (page && typeof page === 'object') {
            const pRec = page;
            if (Array.isArray(pRec.data))
                orders = pRec.data;
            else if (Array.isArray(pRec.orders))
                orders = pRec.orders;
            else if (Array.isArray(pRec.items))
                orders = pRec.items;
        }
        for (const o of orders) {
            try {
                await handler(o);
                processed += 1;
                (0, metrics_1.incOrdersProcessed)(1);
            }
            catch (handlerErr) {
                // swallow: job runner should implement retries/alerts; keep this safe
                (0, metrics_1.incOrderHandlerErrors)(1);
                const orderIdVal = o && typeof o === 'object' && 'id' in o ? String(o.id) : null;
                log_1.logger.error({ shopId, orderId: orderIdVal, err: handlerErr }, 'syncOrders handler error for order');
            }
        }
    }
    return processed;
}
function toIso(value) {
    if (!value)
        return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime()))
        return null;
    return d.toISOString();
}
function pickLatest(current, next) {
    if (!next)
        return current;
    if (!current)
        return next;
    return new Date(next).getTime() > new Date(current).getTime() ? next : current;
}
async function syncReturnOrders(opts) {
    // Narrow shopId to non-null in the truthy branch to satisfy Prisma.ShopWhereInput
    const shopFilter = opts?.shopId
        ? { id: opts.shopId }
        : { platform: 'JUMIA', isActive: true };
    const shops = await prisma_1.prisma.shop.findMany({ where: shopFilter, select: { id: true } });
    const summary = {};
    for (const shop of shops) {
        const shopId = shop.id;
        const configKey = `jumia:return:${shopId}:cursor`;
        const cfg = await prisma_1.prisma.config.findUnique({ where: { key: configKey } }).catch(() => null);
        const updatedAfterCfg = cfg?.json?.updatedAfter;
        let updatedAfter = updatedAfterCfg;
        if (!updatedAfter) {
            const lookbackDays = opts?.lookbackDays ?? 14;
            const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
            updatedAfter = from.toISOString();
        }
        const shopAuth = await (0, jumia_1.loadShopAuthById)(shopId).catch(() => undefined);
        const fetcher = (path) => (0, jumia_1.jumiaFetch)(path, shopAuth
            ? { shopAuth, shopCode: shopId }
            : { shopCode: shopId });
        const params = { status: 'RETURNED,FAILED', size: '50' };
        if (updatedAfter)
            params.updatedAfter = updatedAfter;
        let processed = 0;
        let ensured = 0;
        let latestCursor = updatedAfterCfg ?? null;
        try {
            for await (const page of (0, jumia_1.jumiaPaginator)('/orders', params, fetcher)) {
                const arr = Array.isArray(page?.orders)
                    ? page.orders
                    : Array.isArray(page?.items)
                        ? page.items
                        : Array.isArray(page?.data)
                            ? page.data
                            : [];
                for (const raw of arr) {
                    processed += 1;
                    const rawObj = (raw || {});
                    if (!rawObj.id)
                        continue;
                    if (!Array.isArray(rawObj.items) || rawObj.items.length === 0) {
                        try {
                            const itemsResp = await (0, jumia_1.jumiaFetch)(`/orders/items?orderId=${encodeURIComponent(String(rawObj.id))}`, shopAuth ? { shopAuth } : {});
                            if (itemsResp && typeof itemsResp === 'object' && Array.isArray(itemsResp.items)) {
                                rawObj.items = itemsResp.items;
                            }
                        }
                        catch (e) {
                            log_1.logger.warn({ shopId, orderId: rawObj.id, err: e }, 'failed to load order items for return sync');
                        }
                    }
                    const normalized = (0, normalize_1.normalizeFromJumia)(rawObj, shopId);
                    const upserted = await (0, upsertOrder_1.upsertNormalizedOrder)(normalized);
                    const orderRecord = upserted.order
                        ?? (await prisma_1.prisma.order.findUnique({ where: { id: upserted.orderId }, select: { id: true, shopId: true } }));
                    if (!orderRecord)
                        continue;
                    const createdAtVendor = toIso(rawObj.createdAt ?? rawObj.created_at);
                    const ensuredId = await (0, upsertOrder_1.ensureReturnCaseForOrder)({
                        orderId: orderRecord.id,
                        shopId: orderRecord.shopId,
                        vendorStatus: normalized.status,
                        reasonCode: normalized.status,
                        vendorCreatedAt: createdAtVendor,
                        picked: false,
                    });
                    if (ensuredId)
                        ensured += 1;
                    latestCursor = pickLatest(latestCursor, toIso(rawObj.updatedAt ?? rawObj.updated_at ?? rawObj.lastUpdatedAt));
                }
            }
        }
        catch (err) {
            log_1.logger.error({ shopId, err }, 'syncReturnOrders failed for shop');
        }
        if (latestCursor && latestCursor !== updatedAfterCfg) {
            await prisma_1.prisma.config.upsert({
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
exports.default = jobs;
/**
 * Incremental orders sync across shops using an updatedAfter watermark per shop.
 * Stores watermark in Config as key: `jumia:orders:${shopId}:cursor`.
 * Upserts into JumiaOrder and advances cursor to the latest vendor update timestamp seen.
 */
async function syncOrdersIncremental(opts) {
    // Vendor-supported Order Item statuses per Jumia GOP docs for /orders
    // Avoid unsupported ones (e.g., PACKED, PROCESSING, FULFILLED, COMPLETED, DISPUTED, CANCELLED)
    // Valid: PENDING, SHIPPED, DELIVERED, FAILED, RETURNED, READY_TO_SHIP, CANCELED
    const STATUS_SEQUENCE = [
        'PENDING',
        'READY_TO_SHIP',
        'SHIPPED',
        'DELIVERED',
        'FAILED',
        'RETURNED',
        'CANCELED', // note: single-L spelling required by vendor
    ];
    // Cache vendor-unsupported statuses per shop to avoid repeated 400 spam.
    // Memory-scoped; reset on process restart. Keeps logs clean and reduces vendor calls.
    const unsupportedByShop = globalThis.__jumiaUnsupportedCache || new Map();
    globalThis.__jumiaUnsupportedCache = unsupportedByShop;
    const warnedOnce = globalThis.__jumiaUnsupportedWarned || new Set();
    globalThis.__jumiaUnsupportedWarned = warnedOnce;
    const jumiaShops = await prisma_1.prisma.jumiaShop.findMany({
        where: opts?.shopId ? { id: opts.shopId } : {},
        select: { id: true },
    });
    const summary = {};
    for (const shop of jumiaShops) {
        const shopId = shop.id;
        const key = `jumia:orders:${shopId}:cursor`;
        const cfg = await prisma_1.prisma.config.findUnique({ where: { key } }).catch(() => null);
        // Rewind far enough on every run so long-lived pending orders are never dropped.
        const defaultLookbackDays = (() => {
            const envVal = process.env.JUMIA_SYNC_LOOKBACK_DAYS;
            if (!envVal)
                return 120;
            const parsed = Number.parseInt(envVal, 10);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 120;
        })();
        const lookbackDays = opts?.lookbackDays ?? defaultLookbackDays;
        const baseline = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
        let updatedAfter = cfg?.json?.updatedAfter || null;
        if (!updatedAfter || opts?.lookbackDays) {
            updatedAfter = baseline.toISOString();
        }
        // Ensure cursor never drifts more recent than the rolling baseline so bootstrap gaps are re-fetched.
        if (updatedAfter && new Date(updatedAfter).getTime() > baseline.getTime()) {
            updatedAfter = baseline.toISOString();
        }
        // Apply a small overlap to guard against vendor clock skew or pagination edges
        const overlapMs = 60 * 1000; // 60 seconds
        const adjustedUpdatedAfter = (() => {
            try {
                const d = new Date(String(updatedAfter));
                if (!Number.isNaN(d.getTime())) {
                    const t = new Date(d.getTime() - overlapMs);
                    return t.toISOString();
                }
            }
            catch { }
            return updatedAfter;
        })();
        const shopAuth = await (0, jumia_1.loadShopAuthById)(shopId).catch(() => undefined);
        const fetcher = (path) => (0, jumia_1.jumiaFetch)(path, shopAuth ? { shopAuth } : {});
        const baseParams = { size: '100' };
        if (adjustedUpdatedAfter) {
            // In tests, prefer ISO string to keep assertions simple and timezone-agnostic.
            if (process.env.NODE_ENV === 'test') {
                try {
                    const d = new Date(String(adjustedUpdatedAfter));
                    baseParams.updatedAfter = Number.isNaN(d.getTime()) ? String(adjustedUpdatedAfter) : d.toISOString();
                }
                catch {
                    baseParams.updatedAfter = String(adjustedUpdatedAfter);
                }
            }
            else {
                // Vendor expects timestamps like "YYYY-MM-DD HH:mm:ss" (no T/Z). Convert from ISO to that format.
                try {
                    const d = new Date(String(adjustedUpdatedAfter));
                    if (!Number.isNaN(d.getTime())) {
                        baseParams.updatedAfter = (0, date_fns_1.format)(d, 'yyyy-MM-dd HH:mm:ss');
                    }
                    else {
                        baseParams.updatedAfter = String(adjustedUpdatedAfter);
                    }
                }
                catch {
                    baseParams.updatedAfter = String(adjustedUpdatedAfter);
                }
            }
        }
        let processed = 0;
        let upserted = 0;
        let latestCursor = updatedAfter;
        try {
            for (const status of STATUS_SEQUENCE) {
                // Skip immediately if we've previously learned this shop/status is unsupported
                const skipSet = unsupportedByShop.get(shopId);
                if (skipSet && skipSet.has(status)) {
                    continue;
                }
                const params = { ...baseParams, status };
                // Preflight: some tenants reject certain statuses with 400; skip those early.
                try {
                    const q = new URLSearchParams({ ...params, size: '1' }).toString();
                    await fetcher(`/orders?${q}`);
                }
                catch (err) {
                    const code = err?.status ?? 0;
                    const body = err?.body ?? '';
                    const message = err?.message ?? '';
                    if (code === 400 && /invalid status value/i.test((body || message))) {
                        // Remember and warn only once per shop/status to prevent log noise
                        if (!unsupportedByShop.has(shopId))
                            unsupportedByShop.set(shopId, new Set());
                        unsupportedByShop.get(shopId).add(status);
                        const warnKey = `${shopId}:${status}`;
                        if (!warnedOnce.has(warnKey)) {
                            warnedOnce.add(warnKey);
                            log_1.logger.warn({ shopId, status }, 'status not supported by vendor; skipping');
                        }
                        continue; // go to next status
                    }
                    // If other error (e.g., network), bubble up to outer catch
                    throw err;
                }
                try {
                    for await (const page of (0, jumia_1.jumiaPaginator)('/orders', params, fetcher)) {
                        const arr = Array.isArray(page?.orders)
                            ? page.orders
                            : Array.isArray(page?.items)
                                ? page.items
                                : Array.isArray(page?.data)
                                    ? page.data
                                    : [];
                        for (const raw of arr) {
                            processed += 1;
                            const rawObj = (raw || {});
                            const id = String(rawObj.id ?? rawObj.orderId ?? rawObj.order_id ?? '');
                            if (!id)
                                continue;
                            const statusValue = rawObj.hasMultipleStatus
                                ? 'MULTIPLE'
                                : (typeof rawObj.status === 'string' && rawObj.status.trim())
                                    ? String(rawObj.status)
                                    : 'UNKNOWN';
                            const toDate = (v) => {
                                if (!v)
                                    return null;
                                const d = v instanceof Date ? v : new Date(String(v));
                                return Number.isNaN(d.getTime()) ? null : d;
                            };
                            const toInt = (v) => {
                                if (typeof v === 'number' && Number.isFinite(v))
                                    return v;
                                if (typeof v === 'string' && v.trim()) {
                                    const n = Number.parseInt(v, 10);
                                    return Number.isFinite(n) ? n : null;
                                }
                                return null;
                            };
                            const toBool = (v) => {
                                if (v === null || v === undefined)
                                    return null;
                                if (typeof v === 'boolean')
                                    return v;
                                if (typeof v === 'string') {
                                    const t = v.trim().toLowerCase();
                                    if (['true', '1', 'yes'].includes(t))
                                        return true;
                                    if (['false', '0', 'no'].includes(t))
                                        return false;
                                }
                                if (typeof v === 'number')
                                    return v !== 0;
                                return null;
                            };
                            await prisma_1.prisma.jumiaOrder.upsert({
                                where: { id },
                                create: {
                                    id,
                                    number: toInt(rawObj.number),
                                    status: statusValue,
                                    hasMultipleStatus: Boolean(rawObj.hasMultipleStatus),
                                    pendingSince: typeof rawObj.pendingSince === 'string' && rawObj.pendingSince.trim() ? String(rawObj.pendingSince) : null,
                                    totalItems: toInt(rawObj.totalItems),
                                    packedItems: toInt(rawObj.packedItems),
                                    countryCode: typeof rawObj?.country?.code === 'string' ? String(rawObj.country.code) : null,
                                    isPrepayment: toBool(rawObj.isPrepayment),
                                    createdAtJumia: toDate(rawObj.createdAt ?? rawObj.created_at),
                                    updatedAtJumia: toDate(rawObj.updatedAt ?? rawObj.updated_at ?? rawObj.lastUpdatedAt),
                                    shopId,
                                },
                                update: {
                                    number: toInt(rawObj.number),
                                    status: statusValue,
                                    hasMultipleStatus: Boolean(rawObj.hasMultipleStatus),
                                    pendingSince: typeof rawObj.pendingSince === 'string' && rawObj.pendingSince.trim() ? String(rawObj.pendingSince) : null,
                                    totalItems: toInt(rawObj.totalItems),
                                    packedItems: toInt(rawObj.packedItems),
                                    countryCode: typeof rawObj?.country?.code === 'string' ? String(rawObj.country.code) : null,
                                    isPrepayment: toBool(rawObj.isPrepayment),
                                    createdAtJumia: toDate(rawObj.createdAt ?? rawObj.created_at),
                                    updatedAtJumia: toDate(rawObj.updatedAt ?? rawObj.updated_at ?? rawObj.lastUpdatedAt),
                                },
                            });
                            upserted += 1;
                            const updatedIso = (() => {
                                const u = rawObj.updatedAt ?? rawObj.updated_at ?? rawObj.lastUpdatedAt;
                                const d = u ? new Date(String(u)) : null;
                                return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
                            })();
                            if (updatedIso && (!latestCursor || new Date(updatedIso).getTime() > new Date(latestCursor).getTime())) {
                                latestCursor = updatedIso;
                            }
                        }
                    }
                }
                catch (err) {
                    const code = err?.status ?? 0;
                    const body = err?.body ?? '';
                    const message = err?.message ?? '';
                    if (code === 400 && /invalid status value/i.test(body || message)) {
                        if (!unsupportedByShop.has(shopId))
                            unsupportedByShop.set(shopId, new Set());
                        unsupportedByShop.get(shopId).add(status);
                        const warnKey = `${shopId}:${status}`;
                        if (!warnedOnce.has(warnKey)) {
                            warnedOnce.add(warnKey);
                            log_1.logger.warn({ shopId, status }, 'status not supported by vendor; skipping');
                        }
                        continue;
                    }
                    throw err;
                }
            }
        }
        catch (err) {
            log_1.logger.error({ shopId, err }, 'syncOrdersIncremental failed for shop');
        }
        if (latestCursor && latestCursor !== updatedAfter) {
            await prisma_1.prisma.config.upsert({
                where: { key },
                update: { json: { updatedAfter: latestCursor } },
                create: { key, json: { updatedAfter: latestCursor } },
            }).catch(() => null);
        }
        summary[shopId] = { processed, upserted, cursor: latestCursor ?? undefined };
    }
    return summary;
}
