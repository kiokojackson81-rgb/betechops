import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { fetchPayoutsForShop } from '@/lib/jumia';

async function main() {
  const arg = process.argv[2];
  const day = process.argv[3];
  if (!arg) {
    console.error('Usage: node -r ts-node/register -r tsconfig-paths/register scripts/fetch-live-statement.ts <statementNumber|shopSid> [dayYYYY-MM-DD]');
    process.exit(2);
  }

  const isStmt = /^PS\d/.test(arg);
  let shopSid: string | null = null;
  if (isStmt) {
    const row = await prisma.marketplacePayoutWeek.findFirst({ where: { statementNumber: arg } });
    if (!row) {
      console.error('No local payout week row found for', arg);
      process.exit(2);
    }
    shopSid = (row.rawPayload as any)?.shopSid ?? null;
    if (!shopSid) {
      console.error('No shopSid in local row rawPayload');
      process.exit(2);
    }
  } else {
    shopSid = arg;
  }

  const shop = await prisma.shop.findFirst({ where: { jumiaShopSid: shopSid } });
  if (!shop) {
    console.error('No shop for jumiaShopSid', shopSid);
    process.exit(2);
  }

  console.log('Using shop:', shop.id, shop.name, shop.jumiaShopSid);
  const res = await fetchPayoutsForShop(shop.id, day ? { day } : undefined);
  console.log('Vendor response keys:', Object.keys(res || {}));
  const statements = res?.statements ?? res?.data?.statements ?? res?.data ?? res;
  console.log('Statements count (raw):', Array.isArray(statements) ? statements.length : 'unknown');
  if (Array.isArray(statements)) {
    for (const s of statements) {
      if (s.statementNumber && (s.statementNumber === arg || isStmt === false)) {
        console.log('Matched statement:');
        console.log(JSON.stringify(s, null, 2));
      }
    }
  } else {
    console.log(JSON.stringify(res, null, 2));
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
