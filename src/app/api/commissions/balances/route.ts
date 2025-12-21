import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await requireRole(['ADMIN']);
  if (!guard.ok) return guard.res;

  const balances = await prisma.balance.findMany({ include: { user: { select: { id: true, name: true, email: true } } } });
  return NextResponse.json({ balances });
}
