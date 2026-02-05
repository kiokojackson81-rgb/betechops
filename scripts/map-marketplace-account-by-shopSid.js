#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main() {
  const shopSid = process.argv[2];
  if (!shopSid) {
    console.error('Usage: node scripts/map-marketplace-account-by-shopSid.js <shopSid>');
    process.exit(2);
  }

  try {
    // check existing marketplaceAccount with jumiaShopSid
    const existing = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: shopSid } });
    if (existing) {
      console.log('MarketplaceAccount already mapped:', existing.id, existing.displayName);
      return;
    }

    // try to find a Shop with this jumiaShopSid
    const shop = await prisma.shop.findFirst({ where: { jumiaShopSid: shopSid }, select: { id: true, name: true } });
    if (!shop) {
      console.log('No Shop found with jumiaShopSid:', shopSid);
      console.log('Creating MarketplaceAccount with displayName=Unknown-' + shopSid.slice(0,8));
      const created = await prisma.marketplaceAccount.create({ data: { displayName: 'Unknown ' + shopSid.slice(0,8), jumiaShopSid: shopSid, platform: 'JUMIA', countryCode: 'KE' } });
      console.log('Created marketplaceAccount', created.id);
      return;
    }

    // look for a marketplaceAccount by displayName matching shop.name
    const byName = await prisma.marketplaceAccount.findFirst({ where: { displayName: { contains: shop.name, mode: 'insensitive' } } });
    if (byName) {
      console.log('Found marketplaceAccount by name:', byName.id, byName.displayName, '— updating jumiaShopSid');
      const updated = await prisma.marketplaceAccount.update({ where: { id: byName.id }, data: { jumiaShopSid: shopSid } });
      console.log('Updated marketplaceAccount', updated.id);
      return;
    }

    // create a new marketplaceAccount for the shop
    const created = await prisma.marketplaceAccount.create({ data: { displayName: shop.name || ('Shop ' + shop.id), jumiaShopSid: shopSid, platform: 'JUMIA', countryCode: 'KE' } });
    console.log('Created marketplaceAccount', created.id, 'for Shop', shop.id, shop.name);

  } catch (e) {
    console.error('ERROR', e.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
