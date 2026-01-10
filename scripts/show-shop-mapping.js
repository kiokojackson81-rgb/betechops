try { require('dotenv').config(); } catch {}
const prisma = require('../.worker-dist/src/lib/prisma').prisma;

(async () => {
  try {
    const ids = process.argv.slice(2);
    if (!ids.length) {
      console.error('Usage: node scripts/show-shop-mapping.js <shopId> [shopId..]');
      process.exit(2);
    }

    for (const id of ids) {
      // try by local id first, then by jumiaShopSid
      let shop = await prisma.shop.findUnique({ where: { id }, select: { id: true, name: true, jumiaShopSid: true, platform: true } });
      let lookupBy = 'id';
      if (!shop) {
        shop = await prisma.shop.findFirst({ where: { jumiaShopSid: id }, select: { id: true, name: true, jumiaShopSid: true, platform: true } });
        lookupBy = 'jumiaShopSid';
      }
      if (!shop) {
        // No Shop row; try marketplaceAccount directly by vendor shopSid
        const acctBySid = await prisma.marketplaceAccount.findFirst({ where: { platform: 'JUMIA', jumiaShopSid: id }, select: { id: true, displayName: true, jumiaShopSid: true } });
        if (acctBySid) {
          console.log(`(no Shop row) MarketplaceAccount mapped by jumiaShopSid: ${acctBySid.id} (${acctBySid.displayName})`);
          const latestWeek = await prisma.marketplacePayoutWeek.findMany({ where: { accountId: acctBySid.id }, orderBy: { weekStart: 'desc' }, take: 3, select: { statementNumber: true, weekStart: true, payoutAmount: true } });
          if (latestWeek.length) {
            console.log('  recent MarketplacePayoutWeek:');
            latestWeek.forEach(w => console.log(`    ${w.weekStart.toISOString().slice(0,10)} ${w.statementNumber} → ${w.payoutAmount}`));
          }
          console.log('');
          continue;
        }
        console.log(`${id} -> (no Shop row matching id or jumiaShopSid)`);
        continue;
      }
      console.log(`(lookup by ${lookupBy})`);
      const acct = shop.jumiaShopSid ? await prisma.marketplaceAccount.findFirst({ where: { platform: 'JUMIA', jumiaShopSid: shop.jumiaShopSid }, select: { id: true, displayName: true, jumiaShopSid: true } }) : null;

      console.log(`Shop.id: ${shop.id}`);
      console.log(`  name: ${shop.name}`);
      console.log(`  platform: ${shop.platform}`);
      console.log(`  jumiaShopSid: ${shop.jumiaShopSid ?? '(none)'} `);
      if (acct) {
        console.log(`  -> mapped MarketplaceAccount.id: ${acct.id}`);
        console.log(`     displayName: ${acct.displayName}`);
        console.log(`     acct.jumiaShopSid: ${acct.jumiaShopSid}`);
        const latestWeek = await prisma.marketplacePayoutWeek.findMany({ where: { accountId: acct.id }, orderBy: { weekStart: 'desc' }, take: 3, select: { statementNumber: true, weekStart: true, payoutAmount: true } });
        if (latestWeek.length) {
          console.log('     recent MarketplacePayoutWeek:');
          latestWeek.forEach(w => console.log(`       ${w.weekStart.toISOString().slice(0,10)} ${w.statementNumber} → ${w.payoutAmount}`));
        }
      } else {
        console.log('  -> no MarketplaceAccount mapped for this Shop');
      }
      console.log('');
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    try { await prisma.$disconnect(); } catch {}
    process.exit(1);
  }
})();
