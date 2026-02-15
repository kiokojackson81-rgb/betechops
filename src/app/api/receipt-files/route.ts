import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await requireRole(['ADMIN']);
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const receiptId = url.searchParams.get('receiptId') || undefined;
  const podOnly = ['1', 'true', 'yes'].includes((url.searchParams.get('podOnly') || '').toLowerCase());

  const where: any = {};
  if (receiptId) where.receiptId = receiptId;
  if (podOnly) {
    where.receipt = { data: { path: ['podDelivery'], not: { equals: null } } };
  }

  const files = await prisma.receiptFile.findMany({
    where,
    orderBy: { uploadedAt: 'desc' },
    include: {
      receipt: {
        select: {
          id: true,
          docType: true,
          data: true,
          createdAt: true,
        },
      },
    },
  });

  const filesWithPod = files.map((f) => {
    const receiptObj = f.receipt ?? null;
    const pod =
      receiptObj && typeof receiptObj.data === 'object' && receiptObj.data
        ? (receiptObj.data as any).podDelivery ?? null
        : null;
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
      receiptDocType: receiptObj?.docType ?? null,
      receipt: receiptObj
        ? {
            id: receiptObj.id,
            docType: receiptObj.docType,
            createdAt: receiptObj.createdAt,
            data: receiptObj.data,
          }
        : null,
    };
  });

  return NextResponse.json({ files: filesWithPod });
}
