import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const main = async () => {
  const shops = await prisma.shop.findMany({ select: { id: true, name: true, platform: true, isActive: true }, orderBy: { name: 'asc' } });
  console.log('Shops:');
  for (const s of shops) {
    console.log(`- [${s.platform}] ${s.name} (${s.id}) ${s.isActive ? '' : '(inactive)'}`);
  }
};

await main().finally(async () => { try { await prisma.$disconnect(); } catch {} });
