import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { absUrl } from '@/lib/abs-url';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1) DB-based 7-day pending count (same logic used by KPIs route)
    const queuedDb = await prisma.jumiaOrder.count({
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

    // 2) Small sample of orders to verify presence visually
  const sample = await prisma.jumiaOrder.findMany({
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
  // JumiaOrder doesn't have orderId; it uses id (string) and optional numeric number
  select: { id: true, number: true, status: true, createdAtJumia: true, updatedAtJumia: true, shopId: true },
      take: 5,
      orderBy: { updatedAtJumia: 'desc' },
    });

    // 3) Compare with the KPI endpoint (DB-only mode to avoid live boost)
    const url = await absUrl('/api/metrics/kpis?noLive=1');
    const resp = await fetch(url, { cache: 'no-store' });
    const routeJson: any = resp.ok ? await resp.json() : null;
    const pendingAll = typeof routeJson?.pendingAll === 'number' ? Number(routeJson.pendingAll) : null;

    const out = {
      ok: true,
      now: now.toISOString(),
      windowStart: sevenDaysAgo.toISOString(),
      queuedDb,
      kpisRoute: { status: resp.status, pendingAll, approx: Boolean(routeJson?.approx), updatedAt: routeJson?.updatedAt ?? null },
      equal: pendingAll === null ? null : queuedDb === pendingAll,
      sample,
    };
    const res = NextResponse.json(out);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(msg, { status: 500 });
  }
}
