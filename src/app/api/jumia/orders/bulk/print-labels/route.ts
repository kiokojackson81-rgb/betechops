import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import { collectOrderItemIdsByStatus, printLabels } from '../_helpers';

export async function POST(req: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as {
    shopId?: string;
    orderIds?: string[];
    orderItemIds?: string[];
    includeLabels?: boolean;
    limit?: number;
  };
  const shopId = String(body.shopId || '').trim();
  if (!shopId) return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
  const limit = Math.min(Math.max(body.limit ?? 400, 1), 2000);
  const includeLabels = !!body.includeLabels;

  let orderItemIds = Array.isArray(body.orderItemIds) ? body.orderItemIds.filter(Boolean) : [];
  if (orderItemIds.length === 0) {
    let orderIds = Array.isArray(body.orderIds) ? body.orderIds.filter(Boolean) : [];
    if (orderIds.length === 0) {
      // Prefer orders READY_TO_SHIP for labels, but also allow SHIPPED/DELIVERED
      const rows = await prisma.jumiaOrder.findMany({
        where: { shopId, status: { in: ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED'] } },
        orderBy: { updatedAt: 'desc' },
        take: Math.ceil(limit / 4),
  select: { id: true },
      });
      orderIds = rows.map((r) => r.id);
      if (orderIds.length === 0) {
        // fallback to PACKED
        const rows2 = await prisma.jumiaOrder.findMany({
          where: { shopId, status: 'PACKED' },
          orderBy: { updatedAt: 'desc' },
          take: Math.ceil(limit / 4),
          select: { id: true },
        });
        orderIds = rows2.map((r) => r.id);
      }
    }
    if (orderIds.length) {
      orderItemIds = await collectOrderItemIdsByStatus({ shopId, orderIds, includeStatuses: ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED'], max: limit });
      if (orderItemIds.length === 0) {
        // some partners allow printing when PACKED as well
        orderItemIds = await collectOrderItemIdsByStatus({ shopId, orderIds, includeStatuses: ['PACKED'], max: limit });
      }
    }
  }

  if (orderItemIds.length === 0) return NextResponse.json({ ok: true, message: 'No items eligible for label printing' });
  const resp = await printLabels(shopId, orderItemIds, includeLabels);
  return NextResponse.json(resp);
}
