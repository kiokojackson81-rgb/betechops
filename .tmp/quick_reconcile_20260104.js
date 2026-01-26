require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const canonicalStart = new Date('2026-01-04T00:00:00Z');
  const canonicalEnd = new Date('2026-01-11T00:00:00Z');
  console.log('Canonical window:', canonicalStart.toISOString(), '->', canonicalEnd.toISOString());

  const mpw = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM("grossSales"),0)::numeric(18,2) AS gross, COALESCE(SUM(COALESCE("payoutAmount","grossSales")),0)::numeric(18,2) AS payout
     FROM "MarketplacePayoutWeek"
     WHERE "weekStart" >= '${canonicalStart.toISOString()}'::timestamptz AND "weekStart" < '${canonicalEnd.toISOString()}'::timestamptz`
  );

  const weekly = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM("amount"),0)::numeric(18,2) AS total
     FROM "WeeklySale"
     WHERE "weekStart" = '${canonicalStart.toISOString()}'::timestamptz`
  );

  console.log('MarketplacePayoutWeek:', mpw[0]);
  console.log('WeeklySale (canonical start):', weekly[0]);

  // List per-account mpw sums
  const perAcc = await prisma.$queryRawUnsafe(
    `SELECT "accountId", COUNT(*) AS rows, COALESCE(SUM(COALESCE("payoutAmount","grossSales")),0)::numeric(18,2) AS payout
     FROM "MarketplacePayoutWeek"
     WHERE "weekStart" >= '${canonicalStart.toISOString()}'::timestamptz AND "weekStart" < '${canonicalEnd.toISOString()}'::timestamptz
     GROUP BY "accountId"
     ORDER BY payout DESC`);

  console.log('\nPer-account MarketplacePayoutWeek payouts:');
  for (const r of perAcc) console.log('-', r);
  
  const weeklyRows = await prisma.$queryRawUnsafe(
    `SELECT "id", "shopId", "amount", "source", "status", "weekStart", "weekEnd", "createdAt" FROM "WeeklySale" WHERE "weekStart" = '${canonicalStart.toISOString()}'::timestamptz ORDER BY "amount" DESC`
  );
  console.log('\nWeeklySale rows for canonical week: count=', weeklyRows.length);
  for (const r of weeklyRows) console.log('-', r);

  await prisma.$disconnect();
}

main().catch(async (e)=>{ console.error(e); try{ await (new (require('@prisma/client').PrismaClient)()).$disconnect(); }catch(_){}; process.exit(1); });
