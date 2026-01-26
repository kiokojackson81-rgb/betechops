require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const canonical = new Date('2026-01-05T00:00:00Z');
  const tolMs = 36 * 3600 * 1000;
  const windowStart = new Date(canonical.getTime() - tolMs);
  const windowEnd = new Date(canonical.getTime() + tolMs);

  const rows = await prisma.$queryRaw`
    SELECT mpw."weekStart", SUM(mpw."payoutAmount")::numeric(18,2) AS total, COUNT(*) AS rows
    FROM "MarketplacePayoutWeek" mpw
    WHERE mpw."weekStart" >= ${windowStart} AND mpw."weekStart" < ${windowEnd}
      AND (mpw."rawPayload"->>'statementNumber') LIKE 'PS%'
    GROUP BY mpw."weekStart"
    ORDER BY mpw."weekStart"
  `;

  console.log('Sums grouped by weekStart in window', windowStart.toISOString(), '->', windowEnd.toISOString());
  for (const r of rows) {
    console.log('-', new Date(r.weekStart).toISOString(), '=>', String(r.total), `(${String(r.rows)} rows)`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch(_){}; process.exit(1); });
