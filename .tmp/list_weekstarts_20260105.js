require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const canonical = new Date('2026-01-05T00:00:00Z');
  const tolMs = 36 * 3600 * 1000;
  const windowStart = new Date(canonical.getTime() - tolMs);
  const windowEnd = new Date(canonical.getTime() + tolMs);

  const rows = await prisma.$queryRaw`
    SELECT DISTINCT "weekStart" FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= ${windowStart} AND "weekStart" < ${windowEnd}
    ORDER BY "weekStart"
  `;

  console.log('Distinct weekStart values in window:', windowStart.toISOString(), '->', windowEnd.toISOString());
  for (const r of rows) {
    console.log('-', new Date(r.weekStart).toISOString());
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch(_){}; process.exit(1); });
