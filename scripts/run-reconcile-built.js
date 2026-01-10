try { require('dotenv').config(); } catch {}
const prisma = require('../.worker-dist/src/lib/prisma').prisma;
const jumia = require('../.worker-dist/src/lib/jumia');

(async () => {
  try {
    const arg = process.argv[2];
    const day = process.argv[3];
    if (!arg) {
      console.error('Usage: node scripts/run-reconcile-built.js <statementNumber|shopSid> [dayYYYY-MM-DD]');
      process.exit(2);
    }

    let shopId = null;
    let statementNumber = null;

    if (/^PS\d/.test(arg)) {
      statementNumber = arg;
      const row = await prisma.marketplacePayoutWeek.findFirst({ where: { statementNumber } });
      if (!row) {
        console.error('No DB row for statement', statementNumber);
        process.exit(2);
      }
      const sid = (row.rawPayload && row.rawPayload.shopSid) || null;
      if (!sid) {
        console.error('No shopSid in DB rawPayload for statement');
        process.exit(2);
      }
      const shop = await prisma.shop.findFirst({ where: { jumiaShopSid: sid } });
      if (!shop) {
        console.error('No Shop for jumiaShopSid', sid);
        process.exit(2);
      }
      shopId = shop.id;
    } else {
      // treat as shopSid
      const shop = await prisma.shop.findFirst({ where: { jumiaShopSid: arg } });
      if (!shop) {
        console.error('No Shop for jumiaShopSid', arg);
        process.exit(2);
      }
      shopId = shop.id;
    }

    console.log('Found shopId:', shopId);

    const vendorResp = await jumia.fetchPayoutsForShop(shopId, day ? { day } : undefined);
    const statements = vendorResp?.statements ?? vendorResp?.data?.statements ?? vendorResp?.data ?? vendorResp;
    console.log('Vendor response (keys):', Object.keys(vendorResp || {}));

    let matched = null;
    if (Array.isArray(statements)) {
      if (statementNumber) matched = statements.find((s) => s.statementNumber === statementNumber) || null;
      if (!matched) matched = statements[0] || null;
    } else matched = statements;

    console.log('Matched vendor statement:', matched ? (matched.statementNumber || '(no stmt)') : 'none');
    const vendorAmount = matched?.payout?.amount ?? matched?.closingBalance ?? null;

    const dbRow = statementNumber ? await prisma.marketplacePayoutWeek.findFirst({ where: { statementNumber } }) : null;
    const dbAmount = dbRow ? Number(dbRow.payoutAmount ?? dbRow.grossSales ?? 0) : null;

    console.log('vendorAmount:', vendorAmount);
    console.log('dbAmount:', dbAmount);
    console.log('delta (vendor - db):', vendorAmount != null && dbAmount != null ? (Number(vendorAmount) - Number(dbAmount)) : 'n/a');

    console.log('\nVendor raw payload:\n', JSON.stringify(matched, null, 2));
    console.log('\nDB rawPayload:\n', JSON.stringify(dbRow?.rawPayload ?? null, null, 2));

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    try { await prisma.$disconnect(); } catch {}
    process.exit(1);
  }
})();
