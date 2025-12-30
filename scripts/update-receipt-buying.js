#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  const buying = Number(process.argv[3]);
  if (!id || isNaN(buying)) {
    console.error('Usage: node scripts/update-receipt-buying.js <MARKETING_RECEIPT_ID> <BUYING_TOTAL>');
    process.exit(1);
  }
  try {
    const before = await prisma.marketingReceipt.findUnique({ where: { id }, include: { items: true } });
    console.log('Before:', { id: before.id, sellingTotal: before.sellingTotal, buyingTotal: before.buyingTotal, items: before.items.length });
    await prisma.marketingReceipt.update({ where: { id }, data: { buyingTotal: buying } });
    const after = await prisma.marketingReceipt.findUnique({ where: { id }, include: { items: true } });
    console.log('After:', { id: after.id, sellingTotal: after.sellingTotal, buyingTotal: after.buyingTotal, items: after.items.length });
  } catch (e) {
    console.error('ERR', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
