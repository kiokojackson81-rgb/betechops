import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('letterhead') as File | null;
  const logo = form.get('logo') as File | null;
  const brandColor = (form.get('brandColor') as string | null) || undefined;

  if (!file && !logo && !brandColor) {
    return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 });
  }

  let letterheadUrl: string | undefined;
  let logoUrl: string | undefined;

  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const res = await put(`branding/letterhead-${Date.now()}.jpg`, Buffer.from(arrayBuffer), {
      access: 'public',
      contentType: file.type || 'image/jpeg',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    letterheadUrl = res.url;
  }

  if (logo) {
    const arrayBuffer = await logo.arrayBuffer();
    const res = await put(`branding/logo-${Date.now()}.png`, Buffer.from(arrayBuffer), {
      access: 'public',
      contentType: logo.type || 'image/png',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    logoUrl = res.url;
  }

  const updated = await prisma.branding.upsert({
    where: { name: 'default' },
    update: {
      ...(letterheadUrl ? { letterheadUrl } : {}),
      ...(logoUrl ? { logoUrl } : {}),
      ...(brandColor ? { brandColor } : {}),
    },
    create: {
      name: 'default',
      letterheadUrl: letterheadUrl || process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || '/letterhead.jpg',
      logoUrl: logoUrl || process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png',
      brandColor: brandColor || '#7A2020',
    },
  });

  return NextResponse.json({ ok: true, branding: updated });
}
