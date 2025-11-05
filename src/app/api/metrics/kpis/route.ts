import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readKpisCache } from '@/lib/kpisCache';
import { absUrl } from '@/lib/abs-url';
import { updateKpisCache, updateKpisCacheExact } from '@/lib/jobs/kpis';
import { addDays } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import { readPendingSnapshot, isPendingSnapshotFresh } from '@/lib/jumia/pendingSnapshot';

// Always execute on the server without static caching
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const noLiveParam = url.searchParams.get('noLive') || url.searchParams.get('nolive') || url.searchParams.get('disableLive') || url.searchParams.get('mode');
    const noLive = (noLiveParam || '').toLowerCase() === '1' || (noLiveParam || '').toLowerCase() === 'true' || (noLiveParam || '').toLowerCase() === 'db' || (noLiveParam || '').toLowerCase() === 'db-only';
    const statusesParam = url.searchParams.get('pendingStatuses') || url.searchParams.get('pendingStatus') || url.searchParams.get('status');
    // Default to just PENDING to align with the Vendor Center view; callers can opt-in to MULTIPLE.
    const pendingStatuses = (statusesParam ? statusesParam.split(',') : ['PENDING'])
      .map((s) => s.trim())
      .filter(Boolean);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const DEFAULT_TZ = 'Africa/Nairobi';

    // Pending Orders (All) should reflect the sum of PENDING orders from the last 7 days (Nairobi-aligned).
    const sevenDaysAgo = zonedTimeToUtc(addDays(now, -7), DEFAULT_TZ);
    const queued = await prisma.jumiaOrder.count({
      where: {
        status: { in: pendingStatuses as any },
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

    // Determine staleness: when was the latest pending-row update recorded?
    // Some unit tests mock prisma minimally; guard aggregate call to avoid 500s when not provided.
    let latestUpdatedMillis = 0;
    try {
      const latestAgg = await (prisma as any).jumiaOrder.aggregate({
        _max: { updatedAt: true, updatedAtJumia: true, createdAtJumia: true },
        where: { status: { in: pendingStatuses as any } },
      });
      if (latestAgg && latestAgg._max) {
        latestUpdatedMillis = Math.max(
          latestAgg._max.updatedAt ? new Date(latestAgg._max.updatedAt).getTime() : 0,
          latestAgg._max.updatedAtJumia ? new Date(latestAgg._max.updatedAtJumia).getTime() : 0,
          latestAgg._max.createdAtJumia ? new Date(latestAgg._max.createdAtJumia).getTime() : 0,
        );
      }
    } catch {
      latestUpdatedMillis = 0;
    }
    const staleMinutes = Number(process.env.KPIS_FORCE_LIVE_IF_STALE_MINUTES ?? 3);
    const isStale = latestUpdatedMillis > 0 ? (now.getTime() - latestUpdatedMillis) > staleMinutes * 60 * 1000 : true;
    const todayPacked = await prisma.fulfillmentAudit.count({ where: { ok: true, createdAt: { gte: startOfDay } } });
    const rts = await prisma.fulfillmentAudit.count({ where: { ok: false, createdAt: { gte: startOfDay } } });

    // Cross-shop KPIs (cached ~10 minutes)
    // Fast path: never block the request to compute cache; kick off background refresh instead.
    let cross = await readKpisCache();
    if (!cross) {
      cross = { productsAll: 0, pendingAll: 0, approx: true, updatedAt: Date.now() };
      if (process.env.NODE_ENV !== 'test') {
        // Fire-and-forget cache warm-up; do not await
        Promise.resolve()
          .then(() => updateKpisCache())
          .then((q) => {
            // If quick result still looks approximate/empty, try an exact refresh in the background
            if ((q?.pendingAll ?? 0) === 0 || q?.approx) return updateKpisCacheExact().catch(() => undefined);
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
    let pendingSource: 'db' | 'snapshot' | 'snapshot-partial' | 'live' = 'db';
    try {
      const liveDisabled = String(process.env.KPIS_DISABLE_LIVE_ADJUST || '').toLowerCase() === 'true';
      const preferVendorWhenDiff = String(process.env.KPIS_PREFER_VENDOR_WHEN_DIFF || 'true').toLowerCase() !== 'false';
      const allowLive = (!noLive && !liveDisabled) || (isStale && !liveDisabled);
      if (allowLive) {
        const snapshotMaxAgeMs = Math.max(30_000, Number(process.env.JUMIA_PENDING_SNAPSHOT_MAX_AGE_MS ?? 5 * 60_000));
        const snapshotCandidate = await readPendingSnapshot().catch(() => null);
        let usedSnapshot = false;
        if (snapshotCandidate && isPendingSnapshotFresh(snapshotCandidate, snapshotMaxAgeMs)) {
          const snapshotTotal = Number(snapshotCandidate.totalOrders ?? 0);
          if (preferVendorWhenDiff && snapshotTotal !== queued) {
            pendingAllOut = snapshotTotal;
            approxFlag = true;
          } else if (snapshotTotal > pendingAllOut) {
            pendingAllOut = snapshotTotal;
            approxFlag = true;
          }
          if (snapshotCandidate.ok === false) approxFlag = true;
          pendingSource = snapshotCandidate.ok ? 'snapshot' : 'snapshot-partial';
          usedSnapshot = true;
        }

        if (!usedSnapshot) {
          const LIVE_TIMEOUT_MS = Number(process.env.KPIS_LIVE_TIMEOUT_MS ?? 5000);
          const LIVE_MAX_PAGES = Math.max(1, Number(process.env.KPIS_LIVE_MAX_PAGES ?? 2));
          const start = Date.now();
          let pages = 0;
          let total = 0;
          let token: string | null = null;
          const dateFrom = sevenDaysAgo.toISOString().slice(0, 10);
          const dateTo = now.toISOString().slice(0, 10);
          do {
            const elapsed = Date.now() - start;
            if (elapsed >= LIVE_TIMEOUT_MS) break;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), Math.max(1, LIVE_TIMEOUT_MS - elapsed));
            try {
              // Use vendor-side PENDING status for live boost since vendor supports a single status filter
              const base = `/api/orders?status=PENDING&shopId=ALL&size=100&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}${token ? `&nextToken=${encodeURIComponent(token)}` : ''}`;
              const url = await absUrl(base);
              const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
              if (!res.ok) break;
              const j: any = await res.json();
              const arr = Array.isArray(j?.orders)
                ? j.orders
                : Array.isArray(j?.items)
                ? j.items
                : Array.isArray(j?.data)
                ? j.data
                : [];
              total += arr.length;
              token = (j?.nextToken ? String(j.nextToken) : '') || null;
              pages += 1;
            } catch {
              // Abort/timeout or network error - stop live adjustment and keep DB value
              break;
            } finally {
              clearTimeout(timeout);
            }
          } while (token && pages < LIVE_MAX_PAGES);
          if (pages > 0) {
            // Prefer vendor truth when it differs from DB, unless disabled.
            if (preferVendorWhenDiff && total !== queued) {
              pendingAllOut = total;
              approxFlag = true;
            } else if (total > pendingAllOut) {
              // Legacy behavior: only boost upwards when vendor is higher
              pendingAllOut = total;
              approxFlag = true;
            }
            pendingSource = 'live';
          }
        }
      }
    } catch {
      // ignore network/vendor errors and keep DB-based value
    }

    // If DB looks stale, kick off a background pending sweep to reconcile.
    // Non-blocking and time-limited; safe to fire-and-forget.
    try {
      if (isStale && process.env.NODE_ENV !== 'test') {
        Promise.resolve().then(async () => {
          const urlSync = await absUrl('/api/jumia/sync-pending');
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 5000);
          try { await fetch(urlSync, { cache: 'no-store', signal: controller.signal }); } finally { clearTimeout(t); }
        }).catch(() => undefined);
      }
    } catch {}

    // If vendor live total differs substantially from DB, trigger a quick incremental sync in the background
    // with a small lookback window to align downstream views faster.
    try {
      const diff = Math.abs((pendingAllOut || 0) - (queued || 0));
      const allowKick = diff >= 1; // any difference
      if (allowKick && process.env.NODE_ENV !== 'test') {
        Promise.resolve().then(async () => {
          const urlInc = await absUrl('/api/jumia/jobs/sync-incremental?lookbackDays=3');
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 4000);
          try { await fetch(urlInc, { cache: 'no-store', signal: controller.signal, headers: { 'x-vercel-cron': '1' } }); } finally { clearTimeout(t); }
        }).catch(() => undefined);
      }
    } catch {}

    const dbNowTs = Date.now();
    const res = NextResponse.json({
      ok: true,
      queued,
      todayPacked,
      rts,
      productsAll: cross.productsAll,
      pendingAll: pendingAllOut,
      approx: approxFlag,
      pendingSource,
      stale: isStale,
      latestPendingUpdatedAt: latestUpdatedMillis || undefined,
      // Use a fresh timestamp for the DB-based value so UI reflects DB freshness, not cache time
      updatedAt: dbNowTs,
      updatedAtCross: cross.updatedAt || null,
    });
    // Ensure no CDN caching on this KPI endpoint
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(msg, { status: 500 });
  }
}
