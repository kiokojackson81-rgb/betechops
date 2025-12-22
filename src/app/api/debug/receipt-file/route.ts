import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const adminKey = process.env.ADMIN_DEBUG_KEY || '';
  const provided = req.headers.get('x-admin-key') || new URL(req.url).searchParams.get('key') || '';
  if (!adminKey || provided !== adminKey) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  try {
    const file = await prisma.receiptFile.findFirst({ where: { receiptId: id }, orderBy: { uploadedAt: 'desc' } });
    if (!file) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const out = {
      id: file.id,
      url: file.url,
      key: file.key,
      uploadedAt: file.uploadedAt,
      contentType: file.contentType,
      size: file.size,
    };
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: 'server_error', detail: String(e) }, { status: 500 });
  }
}
