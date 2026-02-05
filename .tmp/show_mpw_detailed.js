#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const rows = await prisma.$queryRaw`
    SELECT id, "weekStart"::text AS weekStart, "weekEnd"::text AS weekEnd,
           ("rawPayload" ->> 'shopSid') AS shopSid,
           "payoutAmount",
           ("rawPayload" -> 'payout' ->> 'amount') AS payout_amount_in_raw
    FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= ${new Date('2026-01-04T00:00:00Z')}
      AND "weekStart" <  ${new Date('2026-01-10T00:00:00Z')}
    ORDER BY "weekStart"
    LIMIT 30
  `;

  for(const r of rows) console.log(r.id, r.weekstart, r.weekend, r.shopsid, r.payoutamount, r.payout_amount_in_raw);
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
