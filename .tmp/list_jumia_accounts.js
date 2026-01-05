const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const rows = await prisma.$queryRaw`SELECT id, "displayName", "jumiaShopSid", "isActive" FROM "MarketplaceAccount" WHERE platform='JUMIA'`;
    console.log('jumia_accounts:');
    console.table(rows);
  } catch (err) {
    console.error('Query failed', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
