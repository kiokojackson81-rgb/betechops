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

  const files = await prisma.receiptFile.findMany({ where, orderBy: { uploadedAt: 'desc' }, include: { receipt: { select: { id: true, data: true, docType: true } } } });

  // Expose a lightweight podDelivery summary for the admin UI
  const filesWithPod = files.map((f) => {
    const pod = f.receipt && typeof f.receipt.data === 'object' && f.receipt.data ? (f.receipt.data as any).podDelivery ?? null : null;
    return {
      id: f.id,
      receiptId: f.receiptId,
      url: f.url,
      key: f.key,
      contentType: f.contentType,
      size: f.size,
      uploadedAt: f.uploadedAt,
      expiresAt: f.expiresAt,
      podDelivery: pod,
      receiptDocType: f.receipt?.docType ?? null,
    };
  });

  return NextResponse.json({ files: filesWithPod });
}
