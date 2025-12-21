import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const letterhead =
    process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL ?? 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/letterhead.png.jpg';
  const logo = process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL ?? '/logo.png';
  const color = '#7A2020';

  await prisma.branding.upsert({
    where: { name: 'default' },
    update: {
      letterheadUrl: letterhead,
      logoUrl: logo,
      brandColor: color,
    },
    create: {
      id: 'seed-default-branding',
      name: 'default',
      letterheadUrl: letterhead,
      logoUrl: logo,
      brandColor: color,
    },
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
