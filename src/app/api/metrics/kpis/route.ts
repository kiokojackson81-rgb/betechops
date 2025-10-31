import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readKpisCache } from '@/lib/kpisCache';
import { updateKpisCache } from '@/lib/jobs/kpis';

export async function GET() {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const queued = await prisma.jumiaOrder.count({ where: { status: 'PENDING' } });
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
          // degrade gracefully
          cross = { productsAll: 0, pendingAll: 0, approx: true, updatedAt: Date.now() };
        }
      }
    }

    return NextResponse.json({
      ok: true,
      queued,
      todayPacked,
      rts,
      productsAll: cross.productsAll,
      pendingAll: cross.pendingAll,
      approx: cross.approx ?? false,
      updatedAt: cross.updatedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(msg, { status: 500 });
  }
}
