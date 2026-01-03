#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) { console.error('Usage: node scripts/inspect-receipt-by-id.js <RECEIPT_ID>'); process.exit(1); }

  try {
    const m = await prisma.marketingReceipt.findUnique({ where: { id }, include: { items: true, dailyEntry: true } });
    const s = await prisma.supportReceipt.findUnique({ where: { id }, include: { items: true, dailyEntry: true } });
    console.log('MARKETING:', !!m);
    if (m) console.log(JSON.stringify(m, null, 2));
    console.log('\nSUPPORT:', !!s);
    if (s) console.log(JSON.stringify(s, null, 2));
  } catch (e) {
    console.error('ERR', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
