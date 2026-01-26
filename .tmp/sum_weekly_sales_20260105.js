require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const canonicalStart = new Date('2026-01-04T00:00:00Z');
  const canonicalEnd = new Date('2026-01-11T00:00:00Z');
  const rows = await prisma.$queryRaw`
    SELECT SUM("amount")::numeric(18,2) AS total, COUNT(*) AS rows
    FROM "WeeklySale"
    WHERE "weekStart" = ${canonicalStart}
  `;
  console.log('WeeklySale sums for canonical weekStart:', rows[0]);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch(_){}; process.exit(1); });
