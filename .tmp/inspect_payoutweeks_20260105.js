require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const canonical = new Date('2026-01-05T00:00:00Z');
  const tolMs = 36 * 3600 * 1000;
  const windowStart = new Date(canonical.getTime() - tolMs);
  const windowEnd = new Date(canonical.getTime() + tolMs);

  const rows = await prisma.$queryRaw`
    SELECT id, "accountId", ("rawPayload"->>'statementNumber') AS stmt, ("rawPayload"->>'shopSid') AS shopSid, "payoutAmount"
    FROM "MarketplacePayoutWeek"
    WHERE "weekStart" >= ${windowStart} AND "weekStart" < ${windowEnd}
      AND ("rawPayload"->>'statementNumber') LIKE 'PS%'
    ORDER BY "payoutAmount" DESC
  `;

  console.log('MarketplacePayoutWeek rows (PS statements) in window:');
  for (const r of rows) console.log('-', r.id, 'accountId=', r.accountid, 'stmt=', r.stmt, 'shopSid=', r.shopsid, 'payout=', String(r.payoutamount));

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch(_){}; process.exit(1); });
