const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const r = await prisma.receipt.findMany({ where: { receiptNumber: { not: null } }, take: 1 });
    console.log('ok', r.length, r[0] ? r[0].receiptNumber : null);
  } catch (e) {
    console.error('ERROR', e);
  } finally {
    await prisma.$disconnect();
  }
})();
