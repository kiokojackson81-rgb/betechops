#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const CANONICAL = new Date('2026-01-04T00:00:00.000Z');
const weekEnd = new Date(CANONICAL.getTime() + 7*24*60*60*1000);

async function main(){
  const rows = await prisma.$queryRaw`
    SELECT ("rawPayload" ->> 'shopSid') AS shopSid,
           SUM("payoutAmount") AS payout,
           count(*) AS cnt,
           array_agg(id) AS ids
    FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= ${CANONICAL}
      AND "weekEnd"   <  ${weekEnd}
    GROUP BY ("rawPayload" ->> 'shopSid')
  `;
  console.log('AGG rows:', rows.length);
  for(const r of rows) console.log(r.shopsid, r.payout, r.cnt, r.ids);
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
