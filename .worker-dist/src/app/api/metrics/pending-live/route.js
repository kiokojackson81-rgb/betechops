"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
const date_fns_2 = require("date-fns");
exports.dynamic = 'force-dynamic';
async function GET(request) {
    const url = new URL(request.url);
    const windowDays = Math.max(1, Number(url.searchParams.get('days') ?? 7));
    const timeoutMs = Math.max(500, Number(url.searchParams.get('timeoutMs') ?? 5000));
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('size') ?? 100)));
    const started = Date.now();
    const deadline = started + timeoutMs;
    const DEFAULT_TZ = 'Africa/Nairobi';
    const now = new Date();
    const windowStart = (0, date_fns_tz_1.zonedTimeToUtc)((0, date_fns_1.addDays)(now, -windowDays), DEFAULT_TZ);
    const windowEnd = (0, date_fns_tz_1.zonedTimeToUtc)(now, DEFAULT_TZ);
    const fmt = (d) => (0, date_fns_2.format)(d, 'yyyy-MM-dd HH:mm:ss');
    // Discover shops known locally
    const shops = await prisma_1.prisma.jumiaShop.findMany({ select: { id: true } });
    const perShop = [];
    for (const s of shops) {
        if (Date.now() >= deadline)
            break;
        const shopId = s.id;
        const shopAuth = await (0, jumia_1.loadShopAuthById)(shopId).catch(() => undefined);
        const baseParams = {
            status: 'PENDING',
            size: String(pageSize),
            shopId,
            updatedAfter: fmt(windowStart),
            updatedBefore: fmt(windowEnd),
            sort: 'DESC',
        };
        let pages = 0;
        let count = 0;
        let approx = false;
        let error = null;
        const fetcher = (path) => (0, jumia_1.jumiaFetch)(path, shopAuth ? { shopAuth, shopCode: shopId } : { shopCode: shopId });
        try {
            for await (const page of (0, jumia_1.jumiaPaginator)('/orders', baseParams, fetcher)) {
                if (Date.now() >= deadline) {
                    approx = true;
                    break;
                }
                const arr = Array.isArray(page?.orders)
                    ? page.orders
                    : Array.isArray(page?.items)
                        ? page.items
                        : Array.isArray(page?.data)
                            ? page.data
                            : [];
                count += arr.length;
                pages += 1;
                if (pages >= 2000) {
                    approx = true;
                    break;
                }
                if (Date.now() >= deadline) {
                    approx = true;
                    break;
                }
            }
        }
        catch (err) {
            error = err instanceof Error ? err.message : String(err);
        }
        perShop.push({ shopId, count, pages, approx: approx || undefined, error: error || undefined });
        if (Date.now() >= deadline)
            break;
    }
    const total = perShop.reduce((acc, r) => acc + r.count, 0);
    const approxGlobal = perShop.length < shops.length || perShop.some((r) => r.approx || r.error);
    const res = server_1.NextResponse.json({
        ok: true,
        total,
        approx: approxGlobal,
        perShop,
        shops: shops.length,
        processedShops: perShop.length,
        tookMs: Date.now() - started,
        windowDays,
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
}
