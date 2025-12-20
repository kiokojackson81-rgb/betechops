// scripts/print-chatrace.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/print-chatrace.js <receiptId>');
  process.exit(2);
}
(async () => {
  try {
    const r = await prisma.receipt.findUnique({ where: { id }, select: { id: true, data: true } });
    const chatrace = r?.data?.chatrace ?? null;
    console.log(JSON.stringify({ id: r?.id || null, chatrace }, null, 2));
  } catch (e) {
    console.error('Failed to read receipt:', e && e.message ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
})();
