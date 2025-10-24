import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN', 'SUPERVISOR']);
  if (!auth.ok) return auth.res;
  const { id: shopId } = await params;
  const assignments = await prisma.userShop.findMany({ where: { shopId }, include: { user: true } });
  return NextResponse.json(assignments);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN']);
  if (!auth.ok) return auth.res;
  const { id: shopId } = await params;
  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  const { userId } = body;
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  await prisma.userShop.deleteMany({ where: { shopId, userId } });
  return NextResponse.json({ ok: true });
}
