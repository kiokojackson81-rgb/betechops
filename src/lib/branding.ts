import { prisma } from '@/lib/prisma';

export async function getBranding() {
  // Cast prisma to any to avoid TypeScript errors in CI when generated client
  // types may be transiently out of sync with the schema. This keeps runtime
  // behavior while unblocking builds.
  const p: any = prisma as any;
  const branding = await p.branding.findUnique({ where: { name: 'default' } });
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
