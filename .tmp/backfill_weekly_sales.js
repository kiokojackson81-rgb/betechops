const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);

  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { weekEnd: { gte: cutoff } },
    orderBy: { weekEnd: 'desc' },
  });
  console.log('Found payout weeks to backfill:', rows.length);

  let created = 0;
  for (const r of rows) {
    // Load marketplace account and try mapping Shop by id === accountId
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: r.accountId } });
    let shop = await prisma.shop.findUnique({ where: { id: r.accountId } });
    if (!shop) {
      // fallback: try find shop by account.displayName
      if (account && account.displayName) {
        shop = await prisma.shop.findFirst({ where: { name: { equals: account.displayName, mode: 'insensitive' } } });
        if (!shop) {
          console.warn('No Shop found for account displayName', account.displayName, 'skipping');
          continue;
        }
      } else {
        console.warn('No Shop or MarketplaceAccount found for payout week.accountId', r.accountId, 'skipping');
        continue;
      }
    }

    try {
        await prisma.weeklySale.upsert({
        where: {
          shopId_platform_weekStart_weekEnd: {
            shopId: shop.id,
              platform: account.platform,
            weekStart: r.weekStart,
            weekEnd: r.weekEnd,
          },
        },
        create: {
          shopId: shop.id,
            platform: account.platform,
          weekStart: r.weekStart,
          weekEnd: r.weekEnd,
          amount: Number(r.payoutAmount ?? r.grossSales ?? 0),
          userId: null,
          status: 'PENDING',
          source: 'AUTOMATIC',
          createdBy: null,
        },
        update: {
          amount: Number(r.payoutAmount ?? r.grossSales ?? 0),
        },
      });
      created++;
    } catch (err) {
      console.error('Failed upserting weekly sale for payout week', r.id, String(err));
    }
  }

  console.log('Backfill complete. Upserted/updated rows:', created);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
