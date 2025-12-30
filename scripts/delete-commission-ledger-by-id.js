#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node scripts/delete-commission-ledger-by-id.js <LEDGER_ID>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const res = await prisma.commissionLedger.deleteMany({ where: { id } });
    console.log('Deleted commission ledger rows:', res.count);
  } catch (e) {
    console.error('Error deleting ledger:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
