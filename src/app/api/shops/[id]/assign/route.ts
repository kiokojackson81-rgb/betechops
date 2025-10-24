import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ShopRoleAtShop } from '@prisma/client';
import { requireRole } from '@/lib/api';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  const { id: shopId } = await params;
  const body = (await request.json().catch(() => ({}))) as { userId?: string; roleAtShop?: string };
  const { userId, roleAtShop } = body;
  if (!userId || !roleAtShop) return NextResponse.json({ error: 'userId and roleAtShop required' }, { status: 400 });

  // validate roleAtShop to match Prisma enum
  const allowed = new Set(['ATTENDANT', 'SUPERVISOR']);
  if (!allowed.has(roleAtShop as string)) return NextResponse.json({ error: 'invalid roleAtShop' }, { status: 400 });
  const role = roleAtShop as ShopRoleAtShop;

  const up = await prisma.userShop.upsert({
    where: { userId_shopId: { userId, shopId } },
  create: { userId, shopId, roleAtShop: role },
  update: { roleAtShop: role },
  });
  return NextResponse.json(up, { status: 201 });
}
