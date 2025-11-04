import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export async function GET(req: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;
  const url = new URL(req.url);
  const shopId = (url.searchParams.get('shopId') || '').trim();
  if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 });
  const row = await prisma.jumiaOrder.findFirst({
    where: { shopId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  }).catch(() => null);
  if (!row) return NextResponse.json({ orderId: null });
  return NextResponse.json({ orderId: row.id });
}
