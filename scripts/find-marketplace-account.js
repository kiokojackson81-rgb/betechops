#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main() {
  const name = process.argv.slice(2).join(' ');
  if (!name) {
    console.error('Usage: node scripts/find-marketplace-account.js <displayName>');
    process.exit(2);
  }
  try {
    const acct = await prisma.marketplaceAccount.findFirst({ where: { displayName: { contains: name, mode: 'insensitive' } }, select: { id: true, displayName: true, jumiaShopSid: true } });
    if (!acct) {
      console.log('NOTFOUND');
    } else {
      console.log(acct.id);
    }
  } catch (e) {
    console.error('ERROR', e.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
