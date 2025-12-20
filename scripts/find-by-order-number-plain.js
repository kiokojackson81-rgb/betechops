// scripts/find-by-order-number-plain.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const orderNumber = process.argv[2];
if (!orderNumber) {
  console.error('Usage: node scripts/find-by-order-number-plain.js <orderNumber>');
  process.exit(2);
}
(async () => {
  try {
    const r = await prisma.receipt.findFirst({ where: { order: { orderNumber } }, select: { id: true, data: true, order: { select: { orderNumber: true, id: true } } } });
    if (!r) {
      console.log('NOT FOUND');
    } else {
      console.log('RECEIPT ID:', r.id);
      console.log('ORDER ID:', r.order?.id || null);
      console.log('ORDER NUMBER:', r.order?.orderNumber || null);
      console.log('DATA:', JSON.stringify(r.data || null, null, 2));
    }
  } catch (e) {
    console.error('Failed:', e && e.message ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
})();
