import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await requireRole(['ADMIN']);
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const receiptId = url.searchParams.get('receiptId') || undefined;

  const where: any = {};
  if (receiptId) where.receiptId = receiptId;

  const files = await prisma.receiptFile.findMany({ where, orderBy: { uploadedAt: 'desc' } });
  return NextResponse.json({ files });
}
