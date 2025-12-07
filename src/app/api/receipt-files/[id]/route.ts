import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import { deleteS3Object } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole(['ADMIN']);
  if (!guard.ok) return guard.res;

  const id = params.id;
  try {
    const file = await prisma.receiptFile.findUnique({ where: { id } });
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // delete S3 object if key present
    try {
      if (file.key && process.env.S3_BUCKET) await deleteS3Object(process.env.S3_BUCKET, file.key);
    } catch (e) {
      console.error('Failed to delete S3 object for receipt file', e);
    }
    await prisma.receiptFile.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
