#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CANONICAL = new Date('2026-01-04T00:00:00.000Z');

async function main() {
  console.log('Starting forced sync: set WeeklySale.amount = MPW payout per shop for weekStart', CANONICAL.toISOString());

  const weekEnd = new Date(CANONICAL.getTime() + 7*24*60*60*1000);

  const rows = await prisma.$queryRaw`
        SELECT ("rawPayload" ->> 'shopSid') AS shopSid,
           SUM("payoutAmount") AS payout
    FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= ${CANONICAL}
      AND "weekStart" <  ${weekEnd}
    GROUP BY ("rawPayload" ->> 'shopSid')
  `;

  console.log('MPW shop count:', rows.length);

  let updated = 0;
  let skippedManual = 0;
  let notMapped = 0;

  for (const r of rows) {
    const shopSid = r.shopSid || r.shopsid || r.SHOPSID || null;
    const payout = parseFloat(r.payout || r.PAYOUT || r.Payout || 0);

    if (!shopSid) continue;

    const shop = await prisma.shop.findFirst({ where: { jumiaShopSid: shopSid } });
    if (!shop) {
      notMapped++;
      console.log('NO SHOP mapping for shopSid', shopSid, 'payout', payout);
      continue;
    }

    const existing = await prisma.weeklySale.findFirst({ where: { shopId: shop.id, weekStart: CANONICAL } });

    if (!existing) {
      await prisma.weeklySale.create({ data: {
        shopId: shop.id,
        weekStart: CANONICAL,
        weekEnd: new Date(weekEnd.getTime() - 1),
        amount: payout,
        source: 'AUTOMATIC',
        notes: 'synchronized-from-mpw-forced'
      }});
      updated++;
      console.log('CREATED WeeklySale for shop', shop.id, 'amount', payout);
      continue;
    }

    if (existing.source === 'MANUAL') {
      skippedManual++;
      console.log('SKIP MANUAL WeeklySale', existing.id, 'shop', shop.id);
      continue;
    }

    const existingAmt = Number(existing.amount || 0);
    if (Math.abs(existingAmt - payout) > 0.0001) {
      await prisma.weeklySale.update({ where: { id: existing.id }, data: { amount: payout } });
      updated++;
      console.log('UPDATED WeeklySale', existing.id, 'shop', shop.id, 'from', existingAmt, '->', payout);
    }
  }

  console.log('Done. updated/created:', updated, 'skippedManual:', skippedManual, 'notMapped:', notMapped);
}

main()
  .catch(e => { console.error('ERROR', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
