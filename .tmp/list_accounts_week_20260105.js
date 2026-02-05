require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const canonical = new Date('2026-01-05T00:00:00Z');
  const tolMs = 36 * 3600 * 1000;
  const windowStart = new Date(canonical.getTime() - tolMs);
  const windowEnd = new Date(canonical.getTime() + tolMs);

  const rows = await prisma.$queryRaw`
    SELECT mpw."accountId",
      ma."displayName" AS accountName,
      ma."jumiaShopSid" AS accountShopSid,
      s.name AS shopName,
      (mpw."rawPayload"->>'shopSid') AS statementShopSid,
      SUM(mpw."payoutAmount")::numeric(18,2) AS amount,
      COUNT(*) AS statements
    FROM "MarketplacePayoutWeek" mpw
    LEFT JOIN "MarketplaceAccount" ma ON ma.id = mpw."accountId"
    LEFT JOIN "Shop" s ON s."jumiaShopSid" = ma."jumiaShopSid"
    WHERE mpw."weekStart" >= ${windowStart} AND mpw."weekStart" < ${windowEnd}
      AND (mpw."rawPayload"->>'statementNumber') LIKE 'PS%'
    GROUP BY mpw."accountId", ma."displayName", ma."jumiaShopSid", s.name, (mpw."rawPayload"->>'shopSid')
    ORDER BY amount DESC
  `;
  const sample = rows[0] || {};
  console.log('DEBUG row keys:', Object.keys(sample));
  for (const k of Object.keys(sample)) {
    const v = sample[k];
    console.log('  -', k, typeof v, v instanceof Date ? v.toISOString() : (typeof v === 'bigint' ? String(v) : v));
  }
  let total = 0;
  console.log('Per-account PS statement sums for window:', windowStart.toISOString(), '->', windowEnd.toISOString());
  for (const r of rows) {
    const amt = Number(r.amount || 0);
    total += amt;
    const acct = await prisma.marketplaceAccount.findUnique({ where: { id: r.accountId } });
    const acctName = acct?.displayName ?? r.accountName ?? '';
    const acctShopSid = acct?.jumiaShopSid ?? r.accountShopSid ?? '';
    const stmtShop = r.statementShopSid || '';
    console.log('-', r.accountId, acctName, acctShopSid || stmtShop, '=>', amt.toFixed(2), `(${String(r.statements)} statements)`);
  }
  console.log('Total PS statements sum =', total.toFixed(2));

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch(_){}; process.exit(1); });
