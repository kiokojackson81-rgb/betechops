import { prisma } from '@/lib/prisma';

async function main() {
  // Cast to any to avoid TypeScript errors when generated @prisma/client types
  // are out of sync during CI/build. The SQL/DB migration must still be applied
  // before this seed is meaningful.
  const p: any = prisma as any;
  await p.branding.upsert({
    where: { name: 'default' },
    update: {
      letterheadUrl: process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || '/letterhead.jpg',
      logoUrl: process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png',
      brandColor: '#7A2020',
    },
    create: {
      name: 'default',
      letterheadUrl: process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || '/letterhead.jpg',
      logoUrl: process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png',
      brandColor: '#7A2020',
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
