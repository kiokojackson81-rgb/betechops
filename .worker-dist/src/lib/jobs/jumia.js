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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fulfillOrder = fulfillOrder;
exports.syncOrders = syncOrders;
exports.syncReturnOrders = syncReturnOrders;
exports.syncOrdersIncremental = syncOrdersIncremental;
const jumia_1 = require("../jumia");
const client_s3_1 = require("@aws-sdk/client-s3");
const log_1 = require("../log");
const prisma_1 = require("../prisma");
const metrics_1 = require("../metrics");
const normalize_1 = require("../connectors/normalize");
const upsertOrder_1 = require("../sync/upsertOrder");
const client_1 = require("@prisma/client");
let _redis;
const _memStore = new Map();
async function ensureRedisClient() {
    if (_redis !== undefined)
        return _redis !== null && _redis !== void 0 ? _redis : null;
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
    catch (_a) {
        _redis = null;
        return null;
    }
}
async function idempotencyGet(key) {
    var _a;
    const r = await ensureRedisClient();
    if (r) {
        try {
            const v = await r.get(key);
            return v ? JSON.parse(v) : null;
        }
        catch (_b) {
            return null;
        }
    }
    return _memStore.has(key) ? (_a = _memStore.get(key)) !== null && _a !== void 0 ? _a : null : null;
}
async function idempotencySet(key, value, ttlSeconds = 60 * 60 * 24 * 7) {
    var _a, _b;
    const r = await ensureRedisClient();
    const payload = JSON.stringify(value);
    if (r) {
        try {
            await r.set(key, payload, 'EX', ttlSeconds);
            return;
        }
        catch (_c) {
            // fall through to mem
        }
    }
    _memStore.set(key, value);
    // In tests, avoid long-lived timers that can cause Jest to hang
    if (process.env.NODE_ENV !== 'test') {
        (_b = (_a = setTimeout(() => _memStore.delete(key), ttlSeconds * 1000)).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
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
    var _a;
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
    catch (_b) {
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
        await idempotencySet(key, toStore, (_a = opts === null || opts === void 0 ? void 0 : opts.ttlSeconds) !== null && _a !== void 0 ? _a : 60 * 60 * 24 * 7);
    }
    catch (_c) {
        log_1.logger.warn({ key }, 'idempotency set failed');
    }
    const took = Date.now() - startTs;
    (0, metrics_1.incFulfillments)(1);
    if (!res.ok)
        (0, metrics_1.incFulfillmentFailures)(1);
    (0, metrics_1.observeFulfillmentLatency)(took);
    // persist audit to DB (best-effort)
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
    catch (_d) {
        log_1.logger.warn({ shopId, orderId }, 'failed to persist FulfillmentAudit');
    }
    log_1.logger.info({ shopId, orderId, status: res.status, durationMs: took }, 'fulfillOrder completed');
    return toStore;
}
/**
 * Iterate orders for a shop and call the provided handler for each order.
 * The handler can be async. Returns the number of orders processed.
 */
async function syncOrders(shopId, handler, params) {
    var _a, e_1, _b, _c;
    var _d, _e;
    const pageParams = {
        shopId,
        status: String((_d = params === null || params === void 0 ? void 0 : params.status) !== null && _d !== void 0 ? _d : 'PENDING'),
        pageSize: String((_e = params === null || params === void 0 ? void 0 : params.pageSize) !== null && _e !== void 0 ? _e : 50),
    };
    let processed = 0;
    try {
        for (var _f = true, _g = __asyncValues((0, jumia_1.jumiaPaginator)('/orders', pageParams)), _h; _h = await _g.next(), _a = _h.done, !_a; _f = true) {
            _c = _h.value;
            _f = false;
            const page = _c;
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
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_f && !_a && (_b = _g.return)) await _b.call(_g);
        }
        finally { if (e_1) throw e_1.error; }
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
    var _a, e_2, _b, _c;
    var _d, _e, _f, _g, _h, _j;
    // Narrow shopId to non-null in the truthy branch to satisfy Prisma.ShopWhereInput
    const shopFilter = (opts === null || opts === void 0 ? void 0 : opts.shopId)
        ? { id: opts.shopId }
        : { platform: client_1.Platform.JUMIA, isActive: true };
    const shops = await prisma_1.prisma.shop.findMany({ where: shopFilter, select: { id: true } });
    const summary = {};
    for (const shop of shops) {
        const shopId = shop.id;
        const configKey = `jumia:return:${shopId}:cursor`;
        const cfg = await prisma_1.prisma.config.findUnique({ where: { key: configKey } }).catch(() => null);
        const updatedAfterCfg = (_d = cfg === null || cfg === void 0 ? void 0 : cfg.json) === null || _d === void 0 ? void 0 : _d.updatedAfter;
        let updatedAfter = updatedAfterCfg;
        if (!updatedAfter) {
            const lookbackDays = (_e = opts === null || opts === void 0 ? void 0 : opts.lookbackDays) !== null && _e !== void 0 ? _e : 14;
            const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
            updatedAfter = from.toISOString();
        }
        const shopAuth = await (0, jumia_1.loadShopAuthById)(shopId).catch(() => undefined);
        const fetcher = (path) => (0, jumia_1.jumiaFetch)(path, shopAuth ? { shopAuth } : {});
        const params = { status: 'RETURNED,FAILED', size: '50' };
        if (updatedAfter)
            params.updatedAfter = updatedAfter;
        let processed = 0;
        let ensured = 0;
        let latestCursor = updatedAfterCfg !== null && updatedAfterCfg !== void 0 ? updatedAfterCfg : null;
        try {
            try {
                for (var _k = true, _l = (e_2 = void 0, __asyncValues((0, jumia_1.jumiaPaginator)('/orders', params, fetcher))), _m; _m = await _l.next(), _a = _m.done, !_a; _k = true) {
                    _c = _m.value;
                    _k = false;
                    const page = _c;
                    const arr = Array.isArray(page === null || page === void 0 ? void 0 : page.orders)
                        ? page.orders
                        : Array.isArray(page === null || page === void 0 ? void 0 : page.items)
                            ? page.items
                            : Array.isArray(page === null || page === void 0 ? void 0 : page.data)
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
                        const orderRecord = (_f = upserted.order) !== null && _f !== void 0 ? _f : (await prisma_1.prisma.order.findUnique({ where: { id: upserted.orderId }, select: { id: true, shopId: true } }));
                        if (!orderRecord)
                            continue;
                        const createdAtVendor = toIso((_g = rawObj.createdAt) !== null && _g !== void 0 ? _g : rawObj.created_at);
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
                        latestCursor = pickLatest(latestCursor, toIso((_j = (_h = rawObj.updatedAt) !== null && _h !== void 0 ? _h : rawObj.updated_at) !== null && _j !== void 0 ? _j : rawObj.lastUpdatedAt));
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_k && !_a && (_b = _l.return)) await _b.call(_l);
                }
                finally { if (e_2) throw e_2.error; }
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
        summary[shopId] = { processed, returnCases: ensured, cursor: latestCursor !== null && latestCursor !== void 0 ? latestCursor : undefined };
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
    var _a, e_3, _b, _c;
    var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    const STATUS_SEQUENCE = ['PENDING', 'PROCESSING', 'FULFILLED', 'COMPLETED', 'CANCELED', 'FAILED', 'RETURNED'];
    const shopFilter = (opts === null || opts === void 0 ? void 0 : opts.shopId)
        ? { id: opts.shopId }
        : { platform: client_1.Platform.JUMIA, isActive: true };
    const shops = await prisma_1.prisma.shop.findMany({ where: shopFilter, select: { id: true } });
    const summary = {};
    for (const shop of shops) {
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
        const lookbackDays = (_d = opts === null || opts === void 0 ? void 0 : opts.lookbackDays) !== null && _d !== void 0 ? _d : defaultLookbackDays;
        const baseline = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
        let updatedAfter = ((_e = cfg === null || cfg === void 0 ? void 0 : cfg.json) === null || _e === void 0 ? void 0 : _e.updatedAfter) || null;
        if (!updatedAfter || (opts === null || opts === void 0 ? void 0 : opts.lookbackDays)) {
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
            catch (_a) { }
            return updatedAfter;
        })();
        const shopAuth = await (0, jumia_1.loadShopAuthById)(shopId).catch(() => undefined);
        const fetcher = (path) => (0, jumia_1.jumiaFetch)(path, shopAuth ? { shopAuth } : {});
        const baseParams = { size: '100' };
        if (adjustedUpdatedAfter)
            baseParams.updatedAfter = adjustedUpdatedAfter;
        let processed = 0;
        let upserted = 0;
        let latestCursor = updatedAfter;
        try {
            for (const status of STATUS_SEQUENCE) {
                const params = Object.assign(Object.assign({}, baseParams), { status });
                try {
                    try {
                        for (var _v = true, _w = (e_3 = void 0, __asyncValues((0, jumia_1.jumiaPaginator)('/orders', params, fetcher))), _x; _x = await _w.next(), _a = _x.done, !_a; _v = true) {
                            _c = _x.value;
                            _v = false;
                            const page = _c;
                            const arr = Array.isArray(page === null || page === void 0 ? void 0 : page.orders)
                                ? page.orders
                                : Array.isArray(page === null || page === void 0 ? void 0 : page.items)
                                    ? page.items
                                    : Array.isArray(page === null || page === void 0 ? void 0 : page.data)
                                        ? page.data
                                        : [];
                            for (const raw of arr) {
                                processed += 1;
                                const rawObj = (raw || {});
                                const id = String((_h = (_g = (_f = rawObj.id) !== null && _f !== void 0 ? _f : rawObj.orderId) !== null && _g !== void 0 ? _g : rawObj.order_id) !== null && _h !== void 0 ? _h : '');
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
                                        countryCode: typeof ((_j = rawObj === null || rawObj === void 0 ? void 0 : rawObj.country) === null || _j === void 0 ? void 0 : _j.code) === 'string' ? String(rawObj.country.code) : null,
                                        isPrepayment: toBool(rawObj.isPrepayment),
                                        createdAtJumia: toDate((_k = rawObj.createdAt) !== null && _k !== void 0 ? _k : rawObj.created_at),
                                        updatedAtJumia: toDate((_m = (_l = rawObj.updatedAt) !== null && _l !== void 0 ? _l : rawObj.updated_at) !== null && _m !== void 0 ? _m : rawObj.lastUpdatedAt),
                                        shopId,
                                    },
                                    update: {
                                        number: toInt(rawObj.number),
                                        status: statusValue,
                                        hasMultipleStatus: Boolean(rawObj.hasMultipleStatus),
                                        pendingSince: typeof rawObj.pendingSince === 'string' && rawObj.pendingSince.trim() ? String(rawObj.pendingSince) : null,
                                        totalItems: toInt(rawObj.totalItems),
                                        packedItems: toInt(rawObj.packedItems),
                                        countryCode: typeof ((_o = rawObj === null || rawObj === void 0 ? void 0 : rawObj.country) === null || _o === void 0 ? void 0 : _o.code) === 'string' ? String(rawObj.country.code) : null,
                                        isPrepayment: toBool(rawObj.isPrepayment),
                                        createdAtJumia: toDate((_p = rawObj.createdAt) !== null && _p !== void 0 ? _p : rawObj.created_at),
                                        updatedAtJumia: toDate((_r = (_q = rawObj.updatedAt) !== null && _q !== void 0 ? _q : rawObj.updated_at) !== null && _r !== void 0 ? _r : rawObj.lastUpdatedAt),
                                    },
                                });
                                upserted += 1;
                                const updatedIso = (() => {
                                    var _a, _b;
                                    const u = (_b = (_a = rawObj.updatedAt) !== null && _a !== void 0 ? _a : rawObj.updated_at) !== null && _b !== void 0 ? _b : rawObj.lastUpdatedAt;
                                    const d = u ? new Date(String(u)) : null;
                                    return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
                                })();
                                if (updatedIso && (!latestCursor || new Date(updatedIso).getTime() > new Date(latestCursor).getTime())) {
                                    latestCursor = updatedIso;
                                }
                            }
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (!_v && !_a && (_b = _w.return)) await _b.call(_w);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                }
                catch (err) {
                    const code = (_s = err === null || err === void 0 ? void 0 : err.status) !== null && _s !== void 0 ? _s : 0;
                    const body = (_t = err === null || err === void 0 ? void 0 : err.body) !== null && _t !== void 0 ? _t : '';
                    const message = (_u = err === null || err === void 0 ? void 0 : err.message) !== null && _u !== void 0 ? _u : '';
                    if (code === 400 && /invalid status value/i.test(body || message)) {
                        log_1.logger.warn({ shopId, status, err }, 'status not supported by vendor; skipping');
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
        summary[shopId] = { processed, upserted, cursor: latestCursor !== null && latestCursor !== void 0 ? latestCursor : undefined };
    }
    return summary;
}
