import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readKpisCache } from '@/lib/kpisCache';
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

    // Cross-shop KPIs (cached 6h)
    let cross = await readKpisCache();
    if (!cross) {
      // compute a quick snapshot and cache (skip in unit tests to avoid DB deps)
      if (process.env.NODE_ENV === 'test') {
        cross = { productsAll: 0, pendingAll: 0, approx: true, updatedAt: Date.now() };
      } else {
        try {
          cross = await updateKpisCache();
        } catch {
          cross = { productsAll: 0, pendingAll: 0, approx: true, updatedAt: Date.now() };
        }
        // If quick snapshot looks empty or approximate, opportunistically try exact once
        if ((cross.pendingAll ?? 0) === 0 || cross.approx) {
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
    const useDbFallback = queued > crossPending;
    const pendingAllOut = useDbFallback ? queued : crossPending;

    return NextResponse.json({
      ok: true,
      queued,
      todayPacked,
      rts,
      productsAll: cross.productsAll,
      pendingAll: pendingAllOut,
      approx: useDbFallback ? true : (cross.approx ?? false),
      updatedAt: cross.updatedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(msg, { status: 500 });
  }
}
