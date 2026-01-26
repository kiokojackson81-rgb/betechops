#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const CANONICAL = new Date('2026-01-04T00:00:00.000Z');
const weekEnd = new Date(CANONICAL.getTime() + 7*24*60*60*1000);

async function main(){
  const mpwTotal = await prisma.$queryRaw`
    SELECT SUM(("rawPayload" -> 'payout' ->> 'amount')::numeric) AS total
    FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= ${CANONICAL} AND "weekStart" < ${weekEnd}
  `;

  const wsTotal = await prisma.$queryRaw`
    SELECT SUM(amount) AS total FROM "WeeklySale" WHERE "weekStart" = ${CANONICAL}
  `;

  console.log('MPW total (rawPayload.payout.amount):', mpwTotal[0].total);
  console.log('WeeklySale total (weekStart canonical):', wsTotal[0].total);

  const perShopMpw = await prisma.$queryRaw`
    SELECT ("rawPayload" ->> 'shopSid') AS shopSid,
           SUM(("rawPayload" -> 'payout' ->> 'amount')::numeric) AS payout
    FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= ${CANONICAL} AND "weekStart" < ${weekEnd}
    GROUP BY ("rawPayload" ->> 'shopSid')
    ORDER BY payout DESC
  `;

  const perShopWs = await prisma.$queryRaw`
    SELECT "shopId", SUM(amount) AS total
    FROM "WeeklySale"
    WHERE "weekStart" = ${CANONICAL}
    GROUP BY "shopId"
    ORDER BY total DESC
  `;

  console.log('\nMPW per-shop:');
  for(const r of perShopMpw) console.log(r.shopsid, r.payout);

  console.log('\nWeeklySale per-shop:');
  for(const r of perShopWs) console.log(r.shopid, r.total);
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
