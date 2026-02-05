import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const displayName = process.argv[2] || 'JUDE COLLECTIONS';
  const statement = process.argv[3] || 'PS251229KE12JUD';
  const amount = Number(process.argv[4] || '171407.13');
  const start = process.argv[5] || '2025-12-29';
  const end = process.argv[6] || '2026-01-04';

  // Create or find marketplaceAccount
  let account = await prisma.marketplaceAccount.findFirst({ where: { displayName: { equals: displayName, mode: 'insensitive' } } });
  if (!account) {
    account = await prisma.marketplaceAccount.create({ data: { displayName, platform: 'JUMIA', isActive: true, countryCode: 'KE' } });
    console.log('Created marketplaceAccount', account.id);
  } else {
    console.log('Found existing marketplaceAccount', account.id);
  }

  // Create or find Shop
  let shop = await prisma.shop.findFirst({ where: { name: { equals: displayName, mode: 'insensitive' } } });
  if (!shop) {
    shop = await prisma.shop.create({ data: { name: displayName, platform: 'JUMIA', isActive: true } });
    console.log('Created shop', shop.id);
  } else {
    console.log('Found existing shop', shop.id);
  }

  const weekStart = new Date(start + 'T00:00:00');
  const weekEnd = new Date(end + 'T23:59:59.999');

  const rawPayload = { shopSid: account.jumiaShopSid ?? null, name: account.displayName };

  const payout = await prisma.marketplacePayoutWeek.upsert({
    where: { accountId_statementNumber: { accountId: account.id, statementNumber: statement } },
    create: {
      accountId: account.id,
      statementNumber: statement,
      weekStart,
      weekEnd,
      grossSales: amount,
      payoutAmount: amount,
      currency: 'KES',
      isPaid: false,
      rawPayload: rawPayload as any,
    },
    update: {
      grossSales: amount,
      payoutAmount: amount,
      isPaid: false,
      rawPayload: rawPayload as any,
    }
  });
  console.log('Upserted payout row', payout.id);

  // Upsert WeeklySale
  const ws = await prisma.weeklySale.upsert({
    where: { shopId_platform_weekStart_weekEnd: { shopId: shop.id, platform: 'JUMIA', weekStart, weekEnd } },
    create: {
      shopId: shop.id,
      platform: 'JUMIA',
      weekStart,
      weekEnd,
      amount,
      status: 'PENDING',
      source: 'AUTOMATIC'
    },
    update: { amount }
  });
  console.log('Upserted WeeklySale', ws.id);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
