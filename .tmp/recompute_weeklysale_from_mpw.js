require('dotenv').config();
const { PrismaClient, Platform, WeeklySaleSource, WeeklySaleStatus } = require('@prisma/client');
const prisma = new PrismaClient();
(async()=>{
  const canonicalStart = '2026-01-04T00:00:00Z';
  const canonicalEnd = '2026-01-11T00:00:00Z';
  // aggregate mpw by shopSid
  const rows = await prisma.$queryRawUnsafe(`
    SELECT ("rawPayload"->>'shopSid') AS shopSid, COALESCE(SUM(COALESCE("payoutAmount","grossSales")),0)::numeric(18,2) AS payout
    FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= '${canonicalStart}'::timestamptz AND "weekStart" < '${canonicalEnd}'::timestamptz
    GROUP BY ("rawPayload"->>'shopSid')
    ORDER BY payout DESC
  `);

  console.log('Computed payouts per shopSid:', rows.length);
  let updated = 0, created = 0, skipped = 0;
  for (const r of rows) {
    const shopSid = r.shopSid;
    if (!shopSid) continue;
    const payout = Number(r.payout ?? 0);
    const shop = await prisma.shop.findFirst({ where: { jumiaShopSid: shopSid } });
    if (!shop) { console.log('No Shop for shopSid', shopSid); continue; }
    const expectedStart = new Date('2026-01-04T00:00:00Z');
    const expectedEnd = new Date('2026-01-11T00:00:00Z');
    const existing = await prisma.weeklySale.findFirst({ where: { shopId: shop.id, weekStart: expectedStart } });
    if (existing) {
      const isManual = existing.source === WeeklySaleSource.MANUAL || existing.createdBy !== null || existing.userId !== null || existing.approvedBy !== null;
      if (isManual) { skipped++; console.log('Skipping manual', shop.id); continue; }
      await prisma.weeklySale.update({ where: { id: existing.id }, data: { amount: payout, source: WeeklySaleSource.AUTOMATIC, status: WeeklySaleStatus.PENDING } });
      updated++;
      console.log('Updated shop', shop.id, 'to', payout);
    } else {
      await prisma.weeklySale.create({ data: { shopId: shop.id, platform: Platform.JUMIA, weekStart: expectedStart, weekEnd: expectedEnd, amount: payout, userId: null, source: WeeklySaleSource.AUTOMATIC, status: WeeklySaleStatus.PENDING } });
      created++;
      console.log('Created WeeklySale for', shop.id, payout);
    }
  }

  console.log('Recompute summary', { updated, created, skipped });
  await prisma.$disconnect();
})();
