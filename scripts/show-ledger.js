const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const id = process.argv[2];
  if (!id) return console.error('Usage: node scripts/show-ledger.js <ledgerId>');
  try {
    const row = await prisma.commissionLedger.findUnique({ where: { id } });
    if (!row) return console.error('Ledger not found:', id);
    console.log(JSON.stringify(row, null, 2));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
