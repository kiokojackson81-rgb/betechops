const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  await prisma.branding.upsert({
    where: { name: 'default' },
    update: {
      letterheadUrl: 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/letterhead.png.jpg',
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
  console.log('branding upserted');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
