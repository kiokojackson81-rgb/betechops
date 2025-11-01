import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readKpisCache } from '@/lib/kpisCache';
import { absUrl } from '@/lib/abs-url';
import { updateKpisCache, updateKpisCacheExact } from '@/lib/jobs/kpis';

export async function GET() {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Pending Orders (All) should reflect the sum of PENDING orders from the last 7 days.
    // Include MULTIPLE (some payloads use it to signal a pending multi-status order).
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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
    let cross = await readKpisCache();
    let quickFailed = false;
    if (!cross) {
      // compute a quick snapshot and cache (skip in unit tests to avoid DB deps)
      if (process.env.NODE_ENV === 'test') {
        cross = { productsAll: 0, pendingAll: 0, approx: true, updatedAt: Date.now() };
      } else {
        try {
          cross = await updateKpisCache();
        } catch {
          quickFailed = true;
          cross = { productsAll: 0, pendingAll: 0, approx: true, updatedAt: Date.now() };
        }
        // If quick snapshot looks empty or approximate, opportunistically try exact once
        if (!quickFailed && ((cross.pendingAll ?? 0) === 0 || cross.approx)) {
          try {
            const exact = await updateKpisCacheExact();
            // prefer exact if it produced a non-zero or non-approx result
            if ((exact.pendingAll ?? 0) > 0 || !exact.approx) cross = exact;
          } catch {
            // ignore if exact fails; quick snapshot already returned
          }
        }
      }
    }

    // For the card, compute the 7-day DB count and also a live vendor aggregation across ALL
    // shops for the same window. If the live total is higher (DB window incomplete), prefer it
    // and mark as approx. This avoids showing only "today" when the sync job covered fewer days.
    let pendingAllOut = queued;
    let approxFlag = false;
    try {
      let total = 0;
      let token: string | null = null;
      const dateFrom = sevenDaysAgo.toISOString().slice(0, 10);
      const dateTo = now.toISOString().slice(0, 10);
      do {
        const base = `/api/orders?status=PENDING&shopId=ALL&size=100&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}${token ? `&nextToken=${encodeURIComponent(token)}` : ''}`;
        const url = await absUrl(base);
        const res = await fetch(url, { cache: 'no-store' });
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
      } while (token);
      if (total > pendingAllOut) { pendingAllOut = total; approxFlag = true; }
    } catch {
      // ignore network/vendor errors and keep DB-based value
    }

    return NextResponse.json({
      ok: true,
      queued,
      todayPacked,
      rts,
      productsAll: cross.productsAll,
      pendingAll: pendingAllOut,
      approx: approxFlag,
      updatedAt: cross.updatedAt || Date.now(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(msg, { status: 500 });
  }
}
