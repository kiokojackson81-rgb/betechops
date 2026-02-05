require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const canonical = new Date('2026-01-05T00:00:00Z');
  const tolMs = 36 * 3600 * 1000;
  const windowStart = new Date(canonical.getTime() - tolMs);
  const windowEnd = new Date(canonical.getTime() + tolMs);

  const rows = await prisma.$queryRaw`
    SELECT (mpw."rawPayload"->>'shopSid') AS shopSid, mpw."accountId", SUM(mpw."payoutAmount")::numeric(18,2) AS amount
    FROM "MarketplacePayoutWeek" mpw
    LEFT JOIN "Shop" s ON (mpw."rawPayload"->>'shopSid') = s."jumiaShopSid"
    WHERE mpw."weekStart" >= ${windowStart} AND mpw."weekStart" < ${windowEnd}
      AND (mpw."rawPayload"->>'statementNumber') LIKE 'PS%'
      AND s.id IS NULL
    GROUP BY (mpw."rawPayload"->>'shopSid'), mpw."accountId"
    ORDER BY amount DESC
  `;

  console.log('Missing Shop records for canonical window:');
  for (const r of rows) {
    console.log('-', r.shopSid || '(null)', 'accountId=', r.accountid, 'amount=', String(r.amount));
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch(_){}; process.exit(1); });
