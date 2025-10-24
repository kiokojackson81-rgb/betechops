import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  const { id: shopId } = params;
  const body = await request.json().catch(() => ({}));
  const { userId, roleAtShop } = body as any;
  if (!userId || !roleAtShop) return NextResponse.json({ error: 'userId and roleAtShop required' }, { status: 400 });

  const up = await prisma.userShop.upsert({
    where: { userId_shopId: { userId, shopId } },
    create: { userId, shopId, roleAtShop },
    update: { roleAtShop },
  });
  return NextResponse.json(up, { status: 201 });
}
