const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const count = await prisma.product.count();
    console.log('TOTAL_PRODUCTS_COUNT', count);
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
