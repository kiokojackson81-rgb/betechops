"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const redis_1 = require("@/lib/redis");
const jumia_1 = require("@/lib/jumia");
const catalog_counters_1 = require("@/lib/catalog-counters");
// GET /api/catalog/products-count
// Params:
// - shopId=<string> | all=true (when omitted and all not true, requires shopId)
// - exact=true|false (default false)
// - ttlMs: optional cache TTL override in milliseconds (default 30 minutes)
// - size, timeMs: optional fine-tuning passed to underlying counters
// Response:
// { total, approx, byStatus, byQcStatus, updatedAt }
async function GET(req) {
    const url = new URL(req.url);
    const shopId = (url.searchParams.get("shopId") || "").trim();
    const all = (url.searchParams.get("all") || "").toLowerCase() === "true";
    const exactFlag = (url.searchParams.get("exact") || "").toLowerCase();
    const exact = exactFlag === "1" || exactFlag === "true" || exactFlag === "yes";
    const ttlMsRaw = Number(url.searchParams.get("ttlMs") || "");
    const ttlMs = Number.isFinite(ttlMsRaw) && ttlMsRaw > 0 ? Math.min(6 * 60 * 60000, ttlMsRaw) : 30 * 60000; // default 30 min, cap 6h
    // Jumia API caps size at 100; clamp accordingly
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get("size") || 100)));
    const timeMs = Math.min(120000, Math.max(5000, Number(url.searchParams.get("timeMs") || (exact ? 60000 : 12000))));
    try {
        const key = `catalog:counts:${all ? "ALL" : shopId || "UNKNOWN"}:${exact ? "exact" : "quick"}`;
        try {
            const r = await (0, redis_1.getRedis)();
            if (r && ttlMs > 0) {
                const hit = await r.get(key);
                if (hit) {
                    const payload = JSON.parse(hit);
                    return server_1.NextResponse.json(payload, { headers: { "x-cache": "hit" } });
                }
            }
        }
        catch {
            // ignore redis errors
        }
        let result = {
            total: 0,
            approx: true,
            byStatus: {},
            byQcStatus: {},
        };
        if (all) {
            if (exact) {
                // Try persisted aggregate first; if stale/missing, compute now and store
                const hit = await (0, catalog_counters_1.getLatestCounters)({ scope: "ALL" }).catch(() => ({ stale: true, row: null }));
                if (hit.row && !hit.stale) {
                    result = (0, catalog_counters_1.rowToSummaryPayload)(hit.row);
                }
                else {
                    const totals = await (0, jumia_1.getCatalogProductsCountExactAll)({ size, timeMs }).catch(() => null);
                    if (totals) {
                        result = totals;
                        // best-effort: persist aggregate for next requests
                        try {
                            await (0, catalog_counters_1.storeAggregateSummary)(result);
                        }
                        catch { }
                    }
                }
            }
            else {
                // quick path: sum quick counts per shop; if no shops or zero totals, fallback to exact-all
                const shops = await (0, jumia_1.getShops)().catch(() => []);
                const shopList = Array.isArray(shops) ? shops : [];
                const counts = await Promise.allSettled(shopList.map((s) => (0, jumia_1.getCatalogProductsCountQuickForShop)({ shopId: String(s.id || s.shopId || ""), limitPages: 4, size: Math.max(size, 50), timeMs })));
                const byStatus = {};
                const byQcStatus = {};
                let total = 0;
                let approx = shopList.length === 0;
                for (const c of counts) {
                    if (c.status === "fulfilled") {
                        const v = c.value;
                        total += Number(v?.total || 0);
                        approx = approx || Boolean(v?.approx);
                        for (const [k, n] of Object.entries(v?.byStatus || {}))
                            byStatus[String(k).toLowerCase()] = (byStatus[String(k).toLowerCase()] || 0) + Number(n || 0);
                        for (const [k, n] of Object.entries(v?.byQcStatus || {}))
                            byQcStatus[String(k).toLowerCase()] = (byQcStatus[String(k).toLowerCase()] || 0) + Number(n || 0);
                    }
                    else {
                        approx = true;
                    }
                }
                // If we couldn't find shops or totals are zero, try an exact-all fallback once
                if (shopList.length === 0 || total === 0) {
                    const fallback = await (0, jumia_1.getCatalogProductsCountExactAll)({ size: Math.min(100, Math.max(size, 50)), timeMs: Math.max(timeMs, 45000) }).catch(() => null);
                    if (fallback) {
                        result = fallback;
                    }
                    else {
                        result = { total, approx: true, byStatus, byQcStatus };
                    }
                }
                else {
                    result = { total, approx, byStatus, byQcStatus };
                }
            }
        }
        else {
            if (!shopId)
                return server_1.NextResponse.json({ error: "shopId required (or set all=true)" }, { status: 400 });
            if (exact) {
                // Prefer persisted exact counters per shop if fresh
                const hit = await (0, catalog_counters_1.getLatestCounters)({ scope: "SHOP", shopId }).catch(() => ({ stale: true, row: null }));
                if (hit.row && !hit.stale) {
                    result = (0, catalog_counters_1.rowToSummaryPayload)(hit.row);
                }
                else {
                    const totals = await (0, jumia_1.getCatalogProductsCountExactForShop)({ shopId, size, timeMs }).catch(() => null);
                    if (totals) {
                        result = totals;
                        // Fire-and-forget: persist latest for next time (skip during tests to avoid DB writes)
                        if (process.env.NODE_ENV !== 'test') {
                            try {
                                await (0, catalog_counters_1.computeAndStoreCountersForShop)(shopId, { size, timeMs });
                            }
                            catch { }
                        }
                    }
                }
            }
            else {
                const totals = await (0, jumia_1.getCatalogProductsCountQuickForShop)({ shopId, limitPages: 6, size: Math.max(size, 100), timeMs }).catch(() => null);
                if (totals)
                    result = totals;
            }
        }
        const payload = { ...result, updatedAt: new Date().toISOString() };
        try {
            const r = await (0, redis_1.getRedis)();
            if (r && ttlMs > 0)
                await r.set(key, JSON.stringify(payload), "EX", Math.max(1, Math.floor(ttlMs / 1000)));
        }
        catch {
            // ignore redis errors
        }
        // Help upstream caches (and Next/Vercel) keep this cheap to re-serve for a short window
        // Quick path is already approximate and persisted; exact path also writes to DB for future hits
        return server_1.NextResponse.json(payload, {
            headers: {
                "x-cache": "miss",
                // Allow short-lived caching at the edge/CDN; clients can still force refresh via UI button
                "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
            },
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
