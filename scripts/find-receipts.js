const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const numbers = ['BETECH2025122841139', 'BETECH2025122898477'];
  try {
    for (const n of numbers) {
      console.log('\nSearching for receiptNumber:', n);
      const sup = await prisma.supportReceipt.findMany({ where: { receiptNumber: n } });
      const r = await prisma.receipt.findMany({ where: { receiptNumber: n } });
      console.log('supportReceipt matches:', sup.length);
      sup.forEach(x => console.log(JSON.stringify(x, null, 2)));
      console.log('receipt matches:', r.length);
      r.forEach(x => console.log(JSON.stringify(x, null, 2)));
    }
  } catch (e) {
    console.error('search failed', e);
  } finally {
    await prisma.$disconnect();
  }
})();
