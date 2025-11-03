import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readKpisCache } from '@/lib/kpisCache';
import { absUrl } from '@/lib/abs-url';
import { updateKpisCache, updateKpisCacheExact } from '@/lib/jobs/kpis';
import { addDays } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';

// Always execute on the server without static caching
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const noLiveParam = url.searchParams.get('noLive') || url.searchParams.get('nolive') || url.searchParams.get('disableLive') || url.searchParams.get('mode');
    const noLive = (noLiveParam || '').toLowerCase() === '1' || (noLiveParam || '').toLowerCase() === 'true' || (noLiveParam || '').toLowerCase() === 'db' || (noLiveParam || '').toLowerCase() === 'db-only';
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const DEFAULT_TZ = 'Africa/Nairobi';

    // Pending Orders (All) should reflect the sum of PENDING orders from the last 7 days.
    // Include MULTIPLE (some payloads use it to signal a pending multi-status order).
    // Align the 7-day window to Nairobi timezone to match how vendor windows are queried by the worker
    const sevenDaysAgo = zonedTimeToUtc(addDays(now, -7), DEFAULT_TZ);
    const queued = await prisma.jumiaOrder.count({
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
    try {
      if (noLive || String(process.env.KPIS_DISABLE_LIVE_ADJUST || '').toLowerCase() === 'true') {
        // Explicitly disabled — skip live boost
        throw new Error('live-adjust-disabled');
      }
      const LIVE_TIMEOUT_MS = Number(process.env.KPIS_LIVE_TIMEOUT_MS ?? 1500);
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
          // Abort/timeout or network error — stop live adjustment and keep DB value
          break;
        } finally {
          clearTimeout(timeout);
        }
      } while (token && pages < LIVE_MAX_PAGES);
      if (total > pendingAllOut) { pendingAllOut = total; approxFlag = true; }
    } catch {
      // ignore network/vendor errors and keep DB-based value
    }

    const res = NextResponse.json({
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(msg, { status: 500 });
  }
}
