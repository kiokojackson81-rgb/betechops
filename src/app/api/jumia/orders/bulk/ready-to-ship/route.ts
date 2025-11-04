import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import { collectOrderItemIdsByStatus, readyToShip } from '../_helpers';

export async function POST(req: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as {
    shopId?: string;
    orderIds?: string[];
    orderItemIds?: string[];
    limit?: number;
  };
  const shopId = String(body.shopId || '').trim();
  if (!shopId) return NextResponse.json({ error: 'shopId is required' }, { status: 400 });

  const limit = Math.min(Math.max(body.limit ?? 400, 1), 2000);
  let orderItemIds = Array.isArray(body.orderItemIds) ? body.orderItemIds.filter(Boolean) : [];

  if (orderItemIds.length === 0) {
    let orderIds = Array.isArray(body.orderIds) ? body.orderIds.filter(Boolean) : [];
    if (orderIds.length === 0) {
      // use PACKED orders from DB as a heuristic to find items ready for RTS
      const rows = await prisma.jumiaOrder.findMany({
        where: { shopId, status: 'PACKED' },
        orderBy: { updatedAt: 'desc' },
        take: Math.ceil(limit / 4),
        select: { id: true },
      });
      orderIds = rows.map((r) => r.id);
      if (orderIds.length === 0) {
        // also try PENDING (in case pack just happened but DB not yet updated)
        const rows2 = await prisma.jumiaOrder.findMany({
          where: { shopId, status: 'PENDING' },
          orderBy: { updatedAt: 'desc' },
          take: Math.ceil(limit / 4),
          select: { id: true },
        });
        orderIds = rows2.map((r) => r.id);
      }
    }
    if (orderIds.length) {
      orderItemIds = await collectOrderItemIdsByStatus({ shopId, orderIds, includeStatuses: ['PACKED'], max: limit });
    }
  }

  if (orderItemIds.length === 0) return NextResponse.json({ ok: true, message: 'No items to mark ready-to-ship' });
  const resp = await readyToShip(shopId, orderItemIds);
  return NextResponse.json(resp);
}
