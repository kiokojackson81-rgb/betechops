import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import { loadDefaultProviders, resolvePackPackagesForOrders, packWithV2 } from '../_helpers';

export async function POST(req: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as {
    shopId?: string;
    orderIds?: string[];
    limit?: number;
  };

  const shopId = String(body.shopId || '').trim();
  if (!shopId) return NextResponse.json({ error: 'shopId is required' }, { status: 400 });

  let orderIds = Array.isArray(body.orderIds) ? body.orderIds.filter(Boolean) : [];
  const limit = Math.min(Math.max(body.limit ?? 200, 1), 1000);

  if (orderIds.length === 0) {
    // fetch PENDING orders from DB for this shop
    const rows = await prisma.jumiaOrder.findMany({
      where: { shopId, status: 'PENDING' },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true },
    });
    orderIds = rows.map((r) => r.id);
  }

  if (orderIds.length === 0) return NextResponse.json({ ok: true, message: 'No eligible orders to pack' });

  const defaultProviders = await loadDefaultProviders();
  const packages = await resolvePackPackagesForOrders({ shopId, orderIds, defaultProviders, maxItems: limit * 4 });
  if (packages.length === 0) return NextResponse.json({ ok: true, message: 'No pending items found in selected orders' });

  const resp = await packWithV2(shopId, packages);
  return NextResponse.json(resp);
}
