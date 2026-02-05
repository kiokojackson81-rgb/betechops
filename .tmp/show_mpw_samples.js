#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const rows = await prisma.$queryRaw`
    SELECT id, "rawPayload"::text AS raw
    FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= ${new Date('2026-01-04T00:00:00Z')}
      AND "weekStart" <  ${new Date('2026-01-10T00:00:00Z')}
    ORDER BY "weekStart" LIMIT 10
  `;
  for(const r of rows) console.log('ID', r.id, '\n', r.raw, '\n---');
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
