import { prisma } from '@/lib/prisma';

async function main() {
  // Use the typed Prisma client for seeding.
  await prisma.branding.upsert({
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
