#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main() {
  const shopSid = process.argv[2];
  if (!shopSid) {
    console.error('Usage: node scripts/link-shop-to-marketplace-account.js <shopIdOrSid>');
    process.exit(2);
  }
  try {
    const shopById = await prisma.shop.findUnique({ where: { id: shopSid }, select: { id: true, name: true, jumiaShopSid: true } });
    if (!shopById) {
      console.log('No Shop with id=', shopSid);
      return;
    }
    if (shopById.jumiaShopSid === shopSid) {
      console.log('Shop already linked jumiaShopSid=', shopSid);
      return;
    }
    const updated = await prisma.shop.update({ where: { id: shopSid }, data: { jumiaShopSid: shopSid } });
    console.log('Updated Shop', updated.id, 'set jumiaShopSid=', updated.jumiaShopSid);
  } catch (e) {
    console.error('ERROR', e.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
