#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const receiptNumber = process.argv[2];
  if (!receiptNumber) {
    console.error('Usage: node scripts/query-receipt-marketing-support.js <RECEIPT_NUMBER>');
    process.exitCode = 2;
    return;
  }

  console.log('Querying for receipt:', receiptNumber);

  const marketing = await prisma.marketingReceipt.findMany({
    where: { receiptNumber },
    include: { items: true, dailyEntry: true }
  });

  const support = await prisma.supportReceipt.findMany({
    where: { receiptNumber },
    include: { items: true, dailyEntry: true }
  });

  // Candidate prices to search for (from UI screenshot)
  const candidatePrices = [20800, 10400];
  const productCosts = await prisma.productCost.findMany({
    where: { OR: candidatePrices.map(p => ({ price: p })) }
  });

  console.log('\n--- MarketingReceipt ---');
  console.log(JSON.stringify(marketing, null, 2));

  console.log('\n--- SupportReceipt ---');
  console.log(JSON.stringify(support, null, 2));

  console.log('\n--- ProductCost matches (by price) ---');
  console.log(JSON.stringify(productCosts, null, 2));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  prisma.$disconnect();
  process.exitCode = 1;
});
