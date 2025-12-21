import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.branding.upsert({
    where: { name: 'default' },
    update: {
      letterheadUrl: 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/letterhead.png.jpg',
      // change logoUrl to an absolute URL if you have it; otherwise keep as relative or blank
      logoUrl: 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/logo.png',
      brandColor: '#7A2020',
    },
    create: {
      id: 'seed-default-branding',
      name: 'default',
      letterheadUrl: 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/letterhead.png.jpg',
      logoUrl: 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/logo.png',
      brandColor: '#7A2020',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
