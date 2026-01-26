require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async()=>{
  const canonicalStart = '2026-01-04T00:00:00Z';
  const canonicalEnd = '2026-01-11T00:00:00Z';
  const rows = await prisma.$queryRawUnsafe(`
    SELECT s.id AS shopId, s."jumiaShopSid" AS shopSid, COALESCE(SUM(COALESCE(mpw."payoutAmount", mpw."grossSales")),0)::numeric(18,2) AS payout
    FROM "MarketplacePayoutWeek" mpw
    LEFT JOIN "Shop" s ON (mpw."rawPayload"->>'shopSid') = s."jumiaShopSid"
    WHERE mpw."weekStart" >= '${canonicalStart}'::timestamptz AND mpw."weekStart" < '${canonicalEnd}'::timestamptz
    GROUP BY s.id, s."jumiaShopSid"
    ORDER BY payout DESC
  `);
  console.log('Mapping rows:');
  for (const r of rows) console.log(r);

  const weekly = await prisma.$queryRawUnsafe(`
    SELECT "shopId", COALESCE(SUM("amount"),0)::numeric(18,2) AS total FROM "WeeklySale" WHERE "weekStart" = '${canonicalStart}'::timestamptz GROUP BY "shopId" ORDER BY total DESC
  `);
  console.log('\nWeeklySale sums by shopId:');
  for (const r of weekly) console.log(r);

  await prisma.$disconnect();
})();
