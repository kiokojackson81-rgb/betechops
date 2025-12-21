const { PrismaClient } = require('@prisma/client');

function serialize(obj) {
  return JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const receiptNumber = 'Betech-20251212-20927';
    const support = await prisma.supportReceipt.findFirst({
      where: { receiptNumber },
      include: { items: true },
    });

    const receipt = await prisma.receipt.findFirst({
      where: { order: { orderNumber: receiptNumber } },
      include: { order: { include: { items: true } }, issuedBy: true },
    });

    console.log('--- supportReceipt ---');
    console.log(support ? serialize(support) : 'NOT FOUND');
    console.log('\n--- supportReceipt.items ---');
    console.log(support && support.items ? serialize(support.items) : 'NO ITEMS');
    console.log('\n--- receipt ---');
    console.log(receipt ? serialize(receipt) : 'NOT FOUND');
  } catch (err) {
    console.error('ERROR', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();

module.exports = { main };
