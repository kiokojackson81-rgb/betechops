const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const statusRows = await prisma.$queryRaw`SELECT status, COUNT(*) as count FROM "MarketplaceOrder" WHERE platform='JUMIA' GROUP BY status`;
    console.log('status_counts:');
    console.table(statusRows);

    const unpricedRows = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "MarketplaceOrder" WHERE platform='JUMIA' AND "buyingPrice" IS NULL`;
    console.log('unpriced_count:', Number(unpricedRows[0]?.count ?? 0));
  } catch (err) {
    console.error('Query failed', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
