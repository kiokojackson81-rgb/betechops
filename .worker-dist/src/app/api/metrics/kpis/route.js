"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const kpisCache_1 = require("@/lib/kpisCache");
const abs_url_1 = require("@/lib/abs-url");
const kpis_1 = require("@/lib/jobs/kpis");
// Always execute on the server without static caching
exports.dynamic = 'force-dynamic';
async function GET(request) {
    var _a, _b;
    try {
        const url = new URL(request.url);
        const noLiveParam = url.searchParams.get('noLive') || url.searchParams.get('nolive') || url.searchParams.get('disableLive') || url.searchParams.get('mode');
        const noLive = (noLiveParam || '').toLowerCase() === '1' || (noLiveParam || '').toLowerCase() === 'true' || (noLiveParam || '').toLowerCase() === 'db' || (noLiveParam || '').toLowerCase() === 'db-only';
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // Pending Orders (All) should reflect the sum of PENDING orders from the last 7 days.
        // Include MULTIPLE (some payloads use it to signal a pending multi-status order).
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const queued = await prisma_1.prisma.jumiaOrder.count({
            where: {
                status: { in: ['PENDING', 'MULTIPLE'] },
                OR: [
                    { updatedAtJumia: { gte: sevenDaysAgo } },
                    { createdAtJumia: { gte: sevenDaysAgo } },
                    {
                        AND: [
                            { updatedAtJumia: null },
                            { createdAtJumia: null },
                            { updatedAt: { gte: sevenDaysAgo } },
                        ],
                    },
                ],
            },
        });
        const todayPacked = await prisma_1.prisma.fulfillmentAudit.count({ where: { ok: true, createdAt: { gte: startOfDay } } });
        const rts = await prisma_1.prisma.fulfillmentAudit.count({ where: { ok: false, createdAt: { gte: startOfDay } } });
        // Cross-shop KPIs (cached ~10 minutes)
        // Fast path: never block the request to compute cache; kick off background refresh instead.
        let cross = await (0, kpisCache_1.readKpisCache)();
        if (!cross) {
            cross = { productsAll: 0, pendingAll: 0, approx: true, updatedAt: Date.now() };
            if (process.env.NODE_ENV !== 'test') {
                // Fire-and-forget cache warm-up; do not await
                Promise.resolve()
                    .then(() => (0, kpis_1.updateKpisCache)())
                    .then((q) => {
                    var _a;
                    // If quick result still looks approximate/empty, try an exact refresh in the background
                    if (((_a = q === null || q === void 0 ? void 0 : q.pendingAll) !== null && _a !== void 0 ? _a : 0) === 0 || (q === null || q === void 0 ? void 0 : q.approx))
                        return (0, kpis_1.updateKpisCacheExact)().catch(() => undefined);
                    return undefined;
                })
                    .catch(() => undefined);
            }
        }
        // For the card, compute the 7-day DB count and also an optional live vendor aggregation across ALL
        // shops for the same window. If the live total is higher (DB window incomplete), prefer it
        // and mark as approx. Time-box the live check to avoid UI blocking.
        let pendingAllOut = queued;
        let approxFlag = false;
        try {
            if (noLive || String(process.env.KPIS_DISABLE_LIVE_ADJUST || '').toLowerCase() === 'true') {
                // Explicitly disabled — skip live boost
                throw new Error('live-adjust-disabled');
            }
            const LIVE_TIMEOUT_MS = Number((_a = process.env.KPIS_LIVE_TIMEOUT_MS) !== null && _a !== void 0 ? _a : 1500);
            const LIVE_MAX_PAGES = Math.max(1, Number((_b = process.env.KPIS_LIVE_MAX_PAGES) !== null && _b !== void 0 ? _b : 2));
            const start = Date.now();
            let pages = 0;
            let total = 0;
            let token = null;
            const dateFrom = sevenDaysAgo.toISOString().slice(0, 10);
            const dateTo = now.toISOString().slice(0, 10);
            do {
                const elapsed = Date.now() - start;
                if (elapsed >= LIVE_TIMEOUT_MS)
                    break;
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), Math.max(1, LIVE_TIMEOUT_MS - elapsed));
                try {
                    const base = `/api/orders?status=PENDING&shopId=ALL&size=100&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}${token ? `&nextToken=${encodeURIComponent(token)}` : ''}`;
                    const url = await (0, abs_url_1.absUrl)(base);
                    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
                    if (!res.ok)
                        break;
                    const j = await res.json();
                    const arr = Array.isArray(j === null || j === void 0 ? void 0 : j.orders)
                        ? j.orders
                        : Array.isArray(j === null || j === void 0 ? void 0 : j.items)
                            ? j.items
                            : Array.isArray(j === null || j === void 0 ? void 0 : j.data)
                                ? j.data
                                : [];
                    total += arr.length;
                    token = ((j === null || j === void 0 ? void 0 : j.nextToken) ? String(j.nextToken) : '') || null;
                    pages += 1;
                }
                catch (_c) {
                    // Abort/timeout or network error — stop live adjustment and keep DB value
                    break;
                }
                finally {
                    clearTimeout(timeout);
                }
            } while (token && pages < LIVE_MAX_PAGES);
            if (total > pendingAllOut) {
                pendingAllOut = total;
                approxFlag = true;
            }
        }
        catch (_d) {
            // ignore network/vendor errors and keep DB-based value
        }
        const res = server_1.NextResponse.json({
            ok: true,
            queued,
            todayPacked,
            rts,
            productsAll: cross.productsAll,
            pendingAll: pendingAllOut,
            approx: approxFlag,
            updatedAt: cross.updatedAt || Date.now(),
        });
        // Ensure no CDN caching on this KPI endpoint
        res.headers.set('Cache-Control', 'no-store');
        return res;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new server_1.NextResponse(msg, { status: 500 });
    }
}
