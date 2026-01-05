const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const res = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "MarketplaceOrder"`;
    console.log('total_marketplace_orders:', Number(res[0]?.count ?? 0));
  } catch (err) {
    console.error('Query failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
