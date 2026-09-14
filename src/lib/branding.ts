import { supervisorSignatureUrl } from "@/lib/supervisorSignature";
import { prisma } from '@/lib/prisma';

export async function getBranding() {
  // Use the typed Prisma client now that generated types are available.
  const branding = await prisma.branding.findUnique({ where: { name: 'default' } });
  return {
    letterheadUrl:
      branding?.letterheadUrl ||
      process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL ||
      '/letterhead.jpg',
    logoUrl:
      branding?.logoUrl || process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png',
    brandColor: branding?.brandColor || '#7A2020',
    digitalStampUrl: branding?.digitalStampUrl || null,
    digitalStampEnabled: Boolean(branding?.digitalStampEnabled),
    licensedProfessional: {
      userId: branding?.licensedProfessionalUserId || null,
      name: branding?.licensedProfessionalName || 'Jonathan Mugiira',
      title: branding?.licensedProfessionalTitle || 'Senior Solar PV & Electrical Engineer',
      qualification: branding?.licensedProfessionalQualification || 'EPRA T3 Solar Photovoltaic Technician',
      licenceNumber: branding?.licensedProfessionalLicenceNumber || 'EPRA/SPVT/001782',
      signatureUrl: supervisorSignatureUrl({ name: branding?.licensedProfessionalName, signatureUrl: branding?.licensedProfessionalSignatureUrl }),
      active: branding?.licensedProfessionalActive ?? true,
    },
    siteTitle: process.env.RECEIPT_SITE_TITLE || 'Betech Solar Solutions',
  };
}

export function sameLicensedProfessional(
  technicianName: string | null | undefined,
  professionalName: string | null | undefined,
) {
  const normalize = (value: string | null | undefined) =>
    String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return Boolean(normalize(technicianName) && normalize(technicianName) === normalize(professionalName));
}
