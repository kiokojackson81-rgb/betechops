try { require('dotenv').config(); } catch {}
const prisma = require('../.worker-dist/src/lib/prisma').prisma;
const jumia = require('../.worker-dist/src/lib/jumia');

(async () => {
  try {
    const arg = process.argv[2];
    if (!arg) {
      console.error('Usage: node scripts/fetch-live-statement.js <statementNumber|shopSid> [dayYYYY-MM-DD]');
      process.exit(2);
    }

    const maybeStmt = arg.match(/^PS\d/); // statement numbers start PS
    const day = process.argv[3];

    let shop = null;
    if (maybeStmt) {
      // find local DB row first to get shopSid
      const row = await prisma.marketplacePayoutWeek.findFirst({ where: { statementNumber: arg } });
      if (!row) {
        console.error('No local payoutweek row found for', arg);
        process.exit(2);
      }
      // find shop by shopSid in rawPayload if present
      const shopSid = (row.rawPayload && row.rawPayload.shopSid) || null;
      if (!shopSid) {
        console.error('No shopSid in local row rawPayload for', arg);
        process.exit(2);
      }
      shop = await prisma.shop.findFirst({ where: { jumiaShopSid: shopSid } });
      if (!shop) {
        console.error('No Shop record found for shopSid', shopSid);
        process.exit(2);
      }
    } else {
      // treat arg as shopSid
      shop = await prisma.shop.findFirst({ where: { jumiaShopSid: arg } });
      if (!shop) {
        console.error('No Shop record found for jumiaShopSid', arg);
        process.exit(2);
      }
    }

    console.log('Found shop id:', shop.id, 'name:', shop.name, 'jumiaShopSid:', shop.jumiaShopSid);

    const res = await jumia.fetchPayoutsForShop(shop.id, day ? { day } : undefined);
    console.log('Vendor response keys:', Object.keys(res));
    // try to extract statements list
    const statements = res?.statements || res?.data?.statements || res?.data || res;
    console.log('Statements count (raw):', Array.isArray(statements) ? statements.length : 'unknown');

    if (Array.isArray(statements)) {
      for (const s of statements) {
        if (s.statementNumber && (s.statementNumber === arg || arg === shop.jumiaShopSid)) {
          console.log('Matched statement:', JSON.stringify(s, null, 2));
        }
      }
    } else {
      console.log('Full response:', JSON.stringify(res, null, 2));
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    try { await prisma.$disconnect(); } catch {}
    process.exit(1);
  }
})();
