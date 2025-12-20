import { prisma } from '@/lib/prisma';

export async function getBranding() {
  const branding = await prisma.branding.findUnique({ where: { name: 'default' } });
  return {
    letterheadUrl:
      branding?.letterheadUrl ||
      process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL ||
      '/letterhead.jpg',
    logoUrl:
      branding?.logoUrl || process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png',
    brandColor: branding?.brandColor || '#7A2020',
    siteTitle: process.env.RECEIPT_SITE_TITLE || 'Betech Solar Solutions',
  };
}
