import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export async function GET(request: Request) {
  const auth = await requireRole(['ADMIN']);
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const shopId = url.searchParams.get('shopId') || undefined;
  const day = url.searchParams.get('day') || undefined;

  const where: any = {};
  if (shopId) where.shopId = shopId;
  if (day) where.day = new Date(day);

  const rows = await prisma.reconciliation.findMany({ where, include: { shop: true } });
  const discrepancies = await prisma.discrepancy.findMany({ where: shopId ? { shopId } : undefined });
  return NextResponse.json({ rows, discrepancies });
}
