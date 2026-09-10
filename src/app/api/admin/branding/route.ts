import { NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireRole(['ADMIN']);
  if (!guard.ok) return guard.res;
  const branding = await prisma.branding.findUnique({ where: { name: 'default' } });
  return NextResponse.json({
    ok: true,
    companyDocuments: {
      digitalStampUrl: branding?.digitalStampUrl || null,
      digitalStampEnabled: Boolean(branding?.digitalStampEnabled),
    },
  });
}

export async function POST(req: Request) {
  const guard = await requireRole(['ADMIN']);
  if (!guard.ok) return guard.res;
  const form = await req.formData();
  const file = form.get('letterhead') as File | null;
  const logo = form.get('logo') as File | null;
  const digitalStamp = form.get('digitalStamp') as File | null;
  const brandColor = (form.get('brandColor') as string | null) || undefined;
  const digitalStampEnabledRaw = form.get('digitalStampEnabled');
  const digitalStampEnabled =
    digitalStampEnabledRaw === null
      ? undefined
      : ['1', 'true', 'yes', 'on'].includes(String(digitalStampEnabledRaw).toLowerCase());
  const removeDigitalStamp = ['1', 'true', 'yes', 'on'].includes(String(form.get('removeDigitalStamp') || '').toLowerCase());

  if (!file && !logo && !digitalStamp && !brandColor && digitalStampEnabled === undefined && !removeDigitalStamp) {
    return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 });
  }

  let letterheadUrl: string | undefined;
  let logoUrl: string | undefined;
  let digitalStampUrl: string | null | undefined;

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

  if (digitalStamp) {
    if (digitalStamp.type !== 'image/png' || digitalStamp.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'Upload a PNG stamp image no larger than 8 MB.' }, { status: 400 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ ok: false, error: 'Stamp storage is not configured.' }, { status: 503 });
    }
    const arrayBuffer = await digitalStamp.arrayBuffer();
    const res = await put(`branding/digital-stamp-${Date.now()}.png`, Buffer.from(arrayBuffer), {
      access: 'public',
      contentType: digitalStamp.type || 'image/png',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    digitalStampUrl = res.url;
  }

  const existing = await prisma.branding.findUnique({ where: { name: 'default' } });
  if (removeDigitalStamp && existing?.digitalStampUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    await del(existing.digitalStampUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
    digitalStampUrl = null;
  }

  // Use the typed Prisma client now that generated types are available.
  const updated = await prisma.branding.upsert({
    where: { name: 'default' },
    update: {
      ...(letterheadUrl ? { letterheadUrl } : {}),
      ...(logoUrl ? { logoUrl } : {}),
      ...(brandColor ? { brandColor } : {}),
      ...(digitalStampUrl !== undefined ? { digitalStampUrl } : {}),
      ...(digitalStampEnabled !== undefined ? { digitalStampEnabled } : {}),
      ...(digitalStamp && digitalStampEnabled === undefined ? { digitalStampEnabled: true } : {}),
    },
    create: {
      name: 'default',
      letterheadUrl: letterheadUrl || process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || '/letterhead.jpg',
      logoUrl: logoUrl || process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png',
      brandColor: brandColor || '#7A2020',
      digitalStampUrl: digitalStampUrl || null,
      digitalStampEnabled: digitalStampEnabled ?? Boolean(digitalStamp),
    },
  });

  return NextResponse.json({ ok: true, branding: updated });
}
