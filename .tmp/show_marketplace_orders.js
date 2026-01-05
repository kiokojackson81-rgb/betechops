const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const rows = await prisma.$queryRaw`SELECT id, "accountId", status, "sellingPrice", "sellerFee", "shippingFee", "createdAt" FROM "MarketplaceOrder" ORDER BY "createdAt" DESC LIMIT 10`;
    console.log('marketplace_orders_sample:');
    console.table(rows);
  } catch (err) {
    console.error('Query failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
