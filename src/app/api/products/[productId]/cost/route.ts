import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireShopAccess } from '@/lib/rbac/shops';
import { getActorId } from '@/lib/api';
import { Prisma } from '@prisma/client';

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const body = (await request.json().catch(() => ({}))) as { shopId?: string; price?: number | string; source?: string };
  const { shopId, price, source = 'MANUAL' } = body;
  if (!shopId || price == null) return NextResponse.json({ error: 'shopId and price required' }, { status: 400 });

  const access = await requireShopAccess({ shopId, minRole: 'SUPERVISOR' });
  if (!access.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const actorId = await getActorId();
  const pc = await prisma.productCost.create({ data: { productId, price: price?.toString() ?? '0', source: (source ?? 'MANUAL') as unknown as any, byUserId: actorId } });
  return NextResponse.json(pc, { status: 201 });
}
