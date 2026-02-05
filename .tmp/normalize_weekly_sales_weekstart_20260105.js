require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const canonicalStart = new Date('2026-01-04T00:00:00Z');
  const canonicalEnd = new Date('2026-01-11T00:00:00Z');
  const canonical = new Date('2026-01-05T00:00:00Z');
  const tolMs = 36 * 3600 * 1000;
  const windowStart = new Date(canonical.getTime() - tolMs);
  const windowEnd = new Date(canonical.getTime() + tolMs);

  console.log('Normalizing WeeklySale.weekStart for rows in window', windowStart.toISOString(), '->', windowEnd.toISOString());
  const res = await prisma.weeklySale.updateMany({
    where: { weekStart: { gte: windowStart, lt: windowEnd }, source: 'AUTOMATIC' },
    data: { weekStart: canonicalStart, weekEnd: canonicalEnd },
  });
  console.log('Updated rows:', res.count);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch(_){}; process.exit(1); });
