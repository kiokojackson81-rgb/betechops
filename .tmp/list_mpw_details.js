require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async()=>{
  const canonicalStart = new Date('2026-01-04T00:00:00Z');
  const canonicalEnd = new Date('2026-01-11T00:00:00Z');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, "accountId", "weekStart", "weekEnd", "grossSales", "payoutAmount", "rawPayload"->>'shopSid' AS shopSid
     FROM "MarketplacePayoutWeek"
     WHERE "weekStart" >= '${canonicalStart.toISOString()}'::timestamptz AND "weekStart" < '${canonicalEnd.toISOString()}'::timestamptz
     ORDER BY "accountId"`
  );
  for (const r of rows) {
    console.log(r);
  }
  await prisma.$disconnect();
})();
