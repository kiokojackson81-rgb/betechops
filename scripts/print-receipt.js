// scripts/print-receipt.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/print-receipt.js <receiptId>');
  process.exit(2);
}
(async () => {
  try {
    const r = await prisma.receipt.findUnique({ where: { id }, select: { id: true, data: true } });
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error('Failed to read receipt:', e && e.message ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
})();
