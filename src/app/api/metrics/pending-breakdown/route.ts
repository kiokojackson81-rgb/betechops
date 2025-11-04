import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addDays } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const daysParam = Number.parseInt(url.searchParams.get('days') || '7', 10);
    const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 7;
    const statusesParam = url.searchParams.get('statuses') || url.searchParams.get('status') || 'PENDING,MULTIPLE';
    const statuses = statusesParam.split(',').map(s => s.trim()).filter(Boolean);

    const now = new Date();
    const since = zonedTimeToUtc(addDays(now, -days), 'Africa/Nairobi');

    const baseWhere: any = {
      status: { in: statuses as any },
      OR: [
        { updatedAtJumia: { gte: since } },
        { createdAtJumia: { gte: since } },
        { AND: [ { updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: { gte: since } } ] },
      ],
    };

    const [byStatus, byShopPending, multiSample] = await Promise.all([
      // Count by status
      (prisma as any).jumiaOrder.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }).catch(() => [] as Array<{ status: string; _count: { _all: number } }>),
      // Per-shop PENDING counts
      (prisma as any).jumiaOrder.groupBy({
        by: ['shopId'],
        where: { ...baseWhere, status: { in: ['PENDING'] as any } },
        _count: { _all: true },
      }).catch(() => [] as Array<{ shopId: string; _count: { _all: number } }>),
      // Sample MULTIPLE rows for audit
      prisma.jumiaOrder.findMany({
        where: { ...baseWhere, status: 'MULTIPLE' as any },
        orderBy: [{ updatedAtJumia: 'desc' }, { updatedAt: 'desc' }],
        take: 50,
        select: { id: true, shopId: true, status: true, hasMultipleStatus: true, totalItems: true, packedItems: true, createdAtJumia: true, updatedAtJumia: true, updatedAt: true },
      }).catch(() => [] as any[]),
    ]);

    const payload = {
      ok: true,
      days,
      since,
      statuses,
      countsByStatus: byStatus.map((r: any) => ({ status: r.status, count: r._count?._all ?? 0 })),
      countsByShopPending: byShopPending.map((r: any) => ({ shopId: r.shopId, count: r._count?._all ?? 0 })),
      multipleSample: multiSample,
    };
    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(msg, { status: 500 });
  }
}
