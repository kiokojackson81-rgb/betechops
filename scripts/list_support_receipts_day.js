const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const start = new Date('2025-12-12T00:00:00+03:00');
    const end = new Date('2025-12-12T23:59:59.999+03:00');
    const receipts = await prisma.supportReceipt.findMany({ where: { dailyEntry: { date: { gte: start, lte: end } } }, include: { items: true } });
    console.log(JSON.stringify(receipts.map(r => ({ id: r.id, receiptNumber: r.receiptNumber, sellingTotal: r.sellingTotal, buyingTotal: r.buyingTotal, items: r.items.map(it=>({id: it.id, buyingPrice: it.buyingPrice})) })), null, 2));
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
  } finally {
    await new PrismaClient().$disconnect();
  }
}

if (require.main === module) main();
