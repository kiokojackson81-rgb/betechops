#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT "weekStart"::text AS weekStart, count(*) AS cnt
    FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= ${new Date('2026-01-01T00:00:00Z')}
      AND "weekStart" <  ${new Date('2026-01-15T00:00:00Z')}
    GROUP BY "weekStart"::text
    ORDER BY 1
  `;
  console.log('Distinct weekStarts:');
  for(const r of rows) console.log(r.weekstart, r.cnt);
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
