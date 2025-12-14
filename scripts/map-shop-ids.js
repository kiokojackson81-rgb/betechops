const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const shops = await prisma.shop.findMany({ select: { id: true, name: true, platform: true } });
    shops.forEach(s => console.log(JSON.stringify(s)));
  } catch (e) {
    console.error('ERROR', e && e.stack ? e.stack : e);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
})();
