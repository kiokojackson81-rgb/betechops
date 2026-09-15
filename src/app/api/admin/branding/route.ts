import { companyStampSettings, DEFAULT_COMPANY_STAMP_URL } from "@/lib/companyStamp";
import { supervisorSignatureUrl } from "@/lib/supervisorSignature";
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
    professionalAccounts: await prisma.user.findMany({ where: { isActive: true, OR: [{ technicalProfile: { isNot: null } }, { role: { in: ['ADMIN', 'SUPERVISOR'] } }] }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }),
    companyDocuments: {
      ...companyStampSettings(branding),
      licensedProfessionalUserId: branding?.licensedProfessionalUserId || null,
      licensedProfessionalName: branding?.licensedProfessionalName || 'Jonathan Mugiira',
      licensedProfessionalTitle: branding?.licensedProfessionalTitle || 'Senior Solar PV & Electrical Engineer',
      licensedProfessionalQualification: branding?.licensedProfessionalQualification || 'EPRA T3 Solar Photovoltaic Technician',
      licensedProfessionalLicenceNumber: branding?.licensedProfessionalLicenceNumber || 'EPRA/SPVT/001782',
      licensedProfessionalSignatureUrl: supervisorSignatureUrl({ name: branding?.licensedProfessionalName, signatureUrl: branding?.licensedProfessionalSignatureUrl }),
      licensedProfessionalActive: branding?.licensedProfessionalActive ?? true,
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
  const professionalSignature = form.get('licensedProfessionalSignature') as File | null;
  const brandColor = (form.get('brandColor') as string | null) || undefined;
  const professionalUserId = form.get('licensedProfessionalUserId');
  if (typeof professionalUserId === 'string' && professionalUserId && !await prisma.user.findFirst({ where: { id: professionalUserId, isActive: true }, select: { id: true } })) return NextResponse.json({ error: 'Select an active professional account.' }, { status: 400 });
  const professionalName = (form.get('licensedProfessionalName') as string | null)?.trim();
  const professionalTitle = (form.get('licensedProfessionalTitle') as string | null)?.trim();
  const professionalQualification = (form.get('licensedProfessionalQualification') as string | null)?.trim();
  const professionalLicenceNumber = (form.get('licensedProfessionalLicenceNumber') as string | null)?.trim();
  const professionalActiveRaw = form.get('licensedProfessionalActive');
  const licensedProfessionalActive = professionalActiveRaw === null ? undefined : ['1', 'true', 'yes', 'on'].includes(String(professionalActiveRaw).toLowerCase());
  const digitalStampEnabledRaw = form.get('digitalStampEnabled');
  const digitalStampEnabled =
    digitalStampEnabledRaw === null
      ? undefined
      : ['1', 'true', 'yes', 'on'].includes(String(digitalStampEnabledRaw).toLowerCase());
  const removeDigitalStamp = ['1', 'true', 'yes', 'on'].includes(String(form.get('removeDigitalStamp') || '').toLowerCase());

  if (!file && !logo && !digitalStamp && !professionalSignature && !brandColor && digitalStampEnabled === undefined && !removeDigitalStamp && professionalName === undefined && professionalTitle === undefined && professionalQualification === undefined && professionalLicenceNumber === undefined && licensedProfessionalActive === undefined) {
    return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 });
  }

  let letterheadUrl: string | undefined;
  let logoUrl: string | undefined;
  let digitalStampUrl: string | null | undefined;
  let professionalSignatureUrl: string | undefined;

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
    if (!/^image\/(png|jpeg|jpg)$/i.test(digitalStamp.type) || digitalStamp.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'Upload a PNG or JPG stamp image no larger than 8 MB.' }, { status: 400 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ ok: false, error: 'Stamp storage is not configured.' }, { status: 503 });
    }
    const arrayBuffer = await digitalStamp.arrayBuffer();
    const ext = /png/i.test(digitalStamp.type) ? "png" : "jpg";
    const res = await put(`branding/digital-stamp-${Date.now()}.${ext}`, Buffer.from(arrayBuffer), {
      access: 'public',
      contentType: digitalStamp.type || 'image/png',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    digitalStampUrl = res.url;
  }

  if (professionalSignature) {
    if (!/^image\/(png|jpeg|jpg)$/i.test(professionalSignature.type) || professionalSignature.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'Upload a PNG or JPG professional signature no larger than 8 MB.' }, { status: 400 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false, error: 'Signature storage is not configured.' }, { status: 503 });
    const bytes = await professionalSignature.arrayBuffer();
    const ext = /png/i.test(professionalSignature.type) ? 'png' : 'jpg';
    const res = await put(`branding/licensed-professional-signature-${Date.now()}.${ext}`, Buffer.from(bytes), {
      access: 'public', contentType: professionalSignature.type, token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    professionalSignatureUrl = res.url;
  }

  const existing = await prisma.branding.findUnique({ where: { name: 'default' } });
  if (removeDigitalStamp) {
    if (existing?.digitalStampUrl && existing.digitalStampUrl !== DEFAULT_COMPANY_STAMP_URL && process.env.BLOB_READ_WRITE_TOKEN) {
      await del(existing.digitalStampUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
    }
    digitalStampUrl = "";
  } else if (!digitalStamp && digitalStampEnabled !== undefined && existing?.digitalStampUrl == null) {
    // Persist the default URL so a later explicit enable/disable choice is retained.
    digitalStampUrl = DEFAULT_COMPANY_STAMP_URL;
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
      ...(professionalUserId !== null ? { licensedProfessionalUserId: String(professionalUserId) || null } : {}),
      ...(professionalName ? { licensedProfessionalName: professionalName } : {}),
      ...(professionalTitle ? { licensedProfessionalTitle: professionalTitle } : {}),
      ...(professionalQualification ? { licensedProfessionalQualification: professionalQualification } : {}),
      ...(professionalLicenceNumber ? { licensedProfessionalLicenceNumber: professionalLicenceNumber } : {}),
      ...(professionalSignatureUrl ? { licensedProfessionalSignatureUrl: professionalSignatureUrl } : {}),
      ...(licensedProfessionalActive !== undefined ? { licensedProfessionalActive } : {}),
    },
    create: {
      name: 'default',
      letterheadUrl: letterheadUrl || process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || '/letterhead.jpg',
      logoUrl: logoUrl || process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png',
      brandColor: brandColor || '#7A2020',
      digitalStampUrl: digitalStampUrl ?? null,
      digitalStampEnabled: digitalStampEnabled ?? Boolean(digitalStamp),
      licensedProfessionalUserId: typeof professionalUserId === 'string' ? professionalUserId || null : null,
      licensedProfessionalName: professionalName || 'Jonathan Mugiira',
      licensedProfessionalTitle: professionalTitle || 'Senior Solar PV & Electrical Engineer',
      licensedProfessionalQualification: professionalQualification || 'EPRA T3 Solar Photovoltaic Technician',
      licensedProfessionalLicenceNumber: professionalLicenceNumber || 'EPRA/SPVT/001782',
      licensedProfessionalSignatureUrl: professionalSignatureUrl || null,
      licensedProfessionalActive: licensedProfessionalActive ?? true,
    },
  });

  return NextResponse.json({ ok: true, branding: updated });
}
