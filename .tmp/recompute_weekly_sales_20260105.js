require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find distinct stored weekStart values for the canonical Nairobi week (tolerance ±36h)
  const canonical = new Date('2026-01-05T00:00:00Z');
  const tolMs = 36 * 3600 * 1000;
  const windowStart = new Date(canonical.getTime() - tolMs);
  const windowEnd = new Date(canonical.getTime() + tolMs);

  const weekStarts = await prisma.$queryRaw`
    SELECT DISTINCT "weekStart" FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= ${windowStart} AND "weekStart" < ${windowEnd}
    ORDER BY "weekStart"
  `;

  for (const w of weekStarts) {
    const weekStart = new Date(w.weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    console.log('Recomputing WeeklySale entries for weekStart', weekStart.toISOString());

    const rows = await prisma.$queryRaw`
      SELECT (mpw."rawPayload"->>'shopSid') AS shopSid, s.id AS shopId, SUM(mpw."payoutAmount")::numeric(18,2) AS amount
      FROM "MarketplacePayoutWeek" mpw
      LEFT JOIN "Shop" s ON (mpw."rawPayload"->>'shopSid') = s."jumiaShopSid"
      WHERE mpw."weekStart" = ${weekStart}
        AND (mpw."rawPayload"->>'statementNumber') LIKE 'PS%'
      GROUP BY (mpw."rawPayload"->>'shopSid'), s.id
    `;

    for (const r of rows) {
      const shopSid = r.shopSid;
      const shopId = r.shopid || null;
      const amt = Number(r.amount || 0);
      console.log('-', shopSid, 'shopId=', shopId, 'amount=', amt.toFixed(2));

      if (!shopId) {
        console.log('  -> skipping: no Shop record for shopSid', shopSid);
        continue;
      }

      const whereKey = { shopId: shopId, weekStart, weekEnd };
      const existing = await prisma.weeklySale.findFirst({ where: whereKey });
      if (!existing) {
        await prisma.weeklySale.create({ data: { ...whereKey, platform: 'JUMIA', amount: amt, userId: null, status: 'PENDING', source: 'AUTOMATIC', createdBy: null, approvedBy: null } });
        console.log('  -> created WeeklySale');
      } else {
        const isManual = existing.source === 'MANUAL' || existing.createdBy !== null || existing.userId !== null || existing.approvedBy !== null;
        if (isManual) {
          console.log('  -> skipping update (manual override)');
        } else {
          await prisma.weeklySale.update({ where: { id: existing.id }, data: { amount: amt } });
          console.log('  -> updated WeeklySale to', amt.toFixed(2));
        }
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch(_){}; process.exit(1); });
