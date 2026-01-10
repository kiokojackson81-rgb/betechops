require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const canonicalWeekStart = new Date('2026-01-05T00:00:00Z');
  const tolMs = 36 * 3600 * 1000;
  const windowStart = new Date(canonicalWeekStart.getTime() - tolMs);
  const windowEnd = new Date(canonicalWeekStart.getTime() + tolMs);

  const rows = await prisma.$queryRaw`
    SELECT ("rawPayload"->>'statementNumber') AS stmt, SUM("payoutAmount")::numeric(18,2) AS amount
    FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= ${windowStart} AND "weekStart" < ${windowEnd}
      AND ("rawPayload"->>'statementNumber') LIKE 'PS%'
    GROUP BY ("rawPayload"->>'statementNumber')
    ORDER BY amount DESC
  `;

  let total = 0;
  console.log('Per-statement sums for window:', windowStart.toISOString(), '->', windowEnd.toISOString());
  for (const r of rows) {
    const amt = Number(r.amount || 0);
    total += amt;
    console.log('-', r.stmt, '=>', amt.toFixed(2));
  }
  console.log('Card total (PS statements only) =', total.toFixed(2));

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch(_){}; process.exit(1); });
