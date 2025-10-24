import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireShopAccess } from '@/lib/rbac/shops';
import { getActorId } from '@/lib/api';

export async function POST(request: Request, { params }: any) {
  const productId = params.productId as string;
  const body = await request.json().catch(() => ({}));
  const { shopId, price, source = 'MANUAL' } = body as any;
  if (!shopId || price == null) return NextResponse.json({ error: 'shopId and price required' }, { status: 400 });

  const access = await requireShopAccess({ shopId, minRole: 'SUPERVISOR' });
  if (!access.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const actorId = await getActorId();
  const pc = await prisma.productCost.create({ data: { productId, price: price.toString(), source, byUserId: actorId } as any });
  return NextResponse.json(pc, { status: 201 });
}
