"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = exports.runtime = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
const abs_url_1 = require("@/lib/abs-url");
const pendingSnapshot_1 = require("@/lib/jumia/pendingSnapshot");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
async function GET(request) {
    try {
        const url = new URL(request.url);
        const daysParam = Number.parseInt(url.searchParams.get('days') || '7', 10);
        const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 7;
        const tz = 'Africa/Nairobi';
        const now = new Date();
        const since = (0, date_fns_tz_1.zonedTimeToUtc)((0, date_fns_1.addDays)(now, -days), tz);
        // DB counts
        const baseOr = [
            { updatedAtJumia: { gte: since } },
            { createdAtJumia: { gte: since } },
            { AND: [{ updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: { gte: since } }] },
        ];
        const [dbPending, dbPendingMultiple] = await Promise.all([
            prisma_1.prisma.jumiaOrder.count({ where: { status: 'PENDING', OR: baseOr } }),
            prisma_1.prisma.jumiaOrder.count({ where: { status: { in: ['PENDING', 'MULTIPLE'] }, OR: baseOr } }),
        ]);
        // Vendor live count: prefer worker snapshot, fallback to live vendor aggregation
        let vendorPending = null;
        let livePages = 0;
        let lastStatus = null;
        let lastError = null;
        let lastTriedUrl = null;
        let vendorSource = 'none';
        let vendorSnapshot = null;
        // Shop diagnostics
        let shopsActive = null;
        let shopsActiveJumia = null;
        // capture shop counts to help diagnose "0 live" scenarios caused by missing shop rows
        try {
            shopsActive = await prisma_1.prisma.shop.count({ where: { isActive: true } });
            shopsActiveJumia = await prisma_1.prisma.shop.count({ where: { isActive: true, platform: 'JUMIA' } });
        }
        catch {
            shopsActive = shopsActiveJumia = null;
        }
        const snapshotMaxAgeMs = Math.max(30000, Number(process.env.JUMIA_PENDING_SNAPSHOT_MAX_AGE_MS ?? 5 * 60000));
        try {
            const snapshotCandidate = await (0, pendingSnapshot_1.readPendingSnapshot)();
            if (snapshotCandidate) {
                vendorSnapshot = snapshotCandidate;
                if ((0, pendingSnapshot_1.isPendingSnapshotFresh)(snapshotCandidate, snapshotMaxAgeMs)) {
                    vendorPending = Number(snapshotCandidate.totalOrders ?? 0);
                    livePages = Number(snapshotCandidate.totalPages ?? 0);
                    lastStatus = snapshotCandidate.ok ? 200 : 206;
                    lastError = snapshotCandidate.error ?? null;
                    lastTriedUrl = 'worker:snapshot';
                    vendorSource = snapshotCandidate.ok ? 'snapshot' : 'snapshot-partial';
                }
                else {
                    lastTriedUrl = 'worker:snapshot';
                    vendorSource = 'snapshot-stale';
                }
            }
        }
        catch (err) {
            if (!lastError)
                lastError = err instanceof Error ? err.message : 'snapshot-read-error';
        }
        if (vendorPending == null) {
            const LIVE_TIMEOUT_MS = Number(process.env.KPIS_LIVE_TIMEOUT_MS ?? 5000);
            const LIVE_MAX_PAGES = Math.max(1, Number(process.env.KPIS_LIVE_MAX_PAGES ?? 5));
            const dateFrom = since.toISOString().slice(0, 10);
            const dateTo = now.toISOString().slice(0, 10);
            const start = Date.now();
            let token = null;
            let total = 0;
            let pages = 0;
            try {
                do {
                    const elapsed = Date.now() - start;
                    if (elapsed >= LIVE_TIMEOUT_MS)
                        break;
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), Math.max(1, LIVE_TIMEOUT_MS - elapsed));
                    try {
                        const base = `/api/orders?status=PENDING&shopId=ALL&size=100&fresh=1&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}${token ? `&nextToken=${encodeURIComponent(token)}` : ''}`;
                        const fetchUrl = await (0, abs_url_1.absUrl)(base);
                        lastTriedUrl = base;
                        const res = await fetch(fetchUrl, { cache: 'no-store', signal: controller.signal });
                        lastStatus = res.status;
                        if (!res.ok) {
                            try {
                                lastError = await res.text();
                            }
                            catch { }
                            break;
                        }
                        const j = await res.json();
                        const arr = Array.isArray(j?.orders) ? j.orders : Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : [];
                        total += arr.length;
                        token = (j?.nextToken ? String(j.nextToken) : '') || null;
                        pages += 1;
                        livePages = pages;
                    }
                    catch (err) {
                        lastError = err instanceof Error ? String(err.message) : 'fetch-error';
                        break;
                    }
                    finally {
                        clearTimeout(timeout);
                    }
                } while (token && pages < LIVE_MAX_PAGES);
                vendorPending = total;
                vendorSource = 'live';
            }
            catch (err) {
                if (!lastError)
                    lastError = err instanceof Error ? err.message : 'fetch-error';
            }
        }
        if (vendorPending == null && vendorSource === 'none' && vendorSnapshot) {
            vendorSource = 'snapshot-stale';
        }
        const payload = {
            ok: true,
            days,
            since,
            db: { pending: dbPending, pendingPlusMultiple: dbPendingMultiple },
            vendor: {
                pending: vendorPending,
                pages: livePages,
                lastStatus,
                lastError,
                lastTriedUrl,
                shopsActive,
                shopsActiveJumia,
                source: vendorSource,
                snapshot: vendorSnapshot,
            },
            diff: vendorPending == null ? null : {
                vendorMinusDbPending: vendorPending - dbPending,
                vendorMinusDbPendingPlusMultiple: vendorPending - dbPendingMultiple,
            },
        };
        const res = server_1.NextResponse.json(payload);
        res.headers.set('Cache-Control', 'no-store');
        return res;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new server_1.NextResponse(msg, { status: 500 });
    }
}
