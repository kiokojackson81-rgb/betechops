import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readKpisCache } from '@/lib/kpisCache';
import { absUrl } from '@/lib/abs-url';
import { updateKpisCache, updateKpisCacheExact } from '@/lib/jobs/kpis';

export async function GET() {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Local cache stores all pending orders regardless of age; count everything we have.
    // Some payloads use MULTIPLE to signal a pending multi-status order, so include it too.
    const queued = await prisma.jumiaOrder.count({
      where: { status: { in: ['PENDING', 'MULTIPLE'] } },
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

    // Ensure Pending Orders (All) reflects the live sum of all currently PENDING orders (no date window).
    // Prefer the vendor aggregate unless the local queued cache is higher (vendor snapshots can lag).
    const crossPending = cross.pendingAll ?? 0;
    let pendingAllOut = queued;
    let approxFlag = false;

    if (pendingAllOut === 0 && crossPending > 0) {
      pendingAllOut = crossPending;
      approxFlag = Boolean(cross.approx);
    }

    // Last-resort guard: if both local DB and cross-shop cache report 0, compute a live
    // aggregate via the internal ALL-shops orders endpoint to avoid zeros after cold start.
    if (pendingAllOut === 0) {
      try {
        let total = 0;
        let token: string | null = null;
        do {
          const base = `/api/orders?status=PENDING&shopId=ALL&size=100${token ? `&nextToken=${encodeURIComponent(token)}` : ''}`;
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
        if (total > 0) {
          pendingAllOut = total;
          approxFlag = true; // computed live without persistence
        }
      } catch {
        // ignore; keep 0
      }
    }

    return NextResponse.json({
      ok: true,
      queued,
      todayPacked,
      rts,
      productsAll: cross.productsAll,
      pendingAll: pendingAllOut,
      approx: approxFlag,
      updatedAt: cross.updatedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(msg, { status: 500 });
  }
}
