require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const canonical = new Date('2026-01-05T00:00:00Z');
  const tolMs = 36 * 3600 * 1000;
  const windowStart = new Date(canonical.getTime() - tolMs);
  const windowEnd = new Date(canonical.getTime() + tolMs);

  const rows = await prisma.$queryRaw`
    SELECT DISTINCT (mpw."rawPayload"->>'shopSid') AS shopSid
    FROM "MarketplacePayoutWeek" mpw
    LEFT JOIN "Shop" s ON (mpw."rawPayload"->>'shopSid') = s."jumiaShopSid"
    WHERE mpw."weekStart" >= ${windowStart} AND mpw."weekStart" < ${windowEnd}
      AND (mpw."rawPayload"->>'statementNumber') LIKE 'PS%'
      AND s.id IS NULL
  `;

  for (const r of rows) {
    const sid = r.shopsid;
    if (!sid) continue;
    console.log('Creating Shop for jumiaShopSid', sid);
    try {
      await prisma.shop.create({ data: { name: `Jumia Shop ${sid}`, platform: 'JUMIA', jumiaShopSid: sid, isActive: true } });
    } catch (e) {
      console.log('  create failed (maybe exists):', e.message || e);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch(_){}; process.exit(1); });
