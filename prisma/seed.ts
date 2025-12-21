import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
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
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
