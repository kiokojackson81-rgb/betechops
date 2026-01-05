const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28); // last 4 weeks

  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { weekEnd: { gte: cutoff } },
    orderBy: { weekEnd: 'desc' },
  });

  console.log('Found payout weeks to backfill:', rows.length);

  let created = 0;
  for (const r of rows) {
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: r.accountId } });
    if (!account) {
      console.warn('No MarketplaceAccount found for payout week.accountId', r.accountId, 'skipping');
      continue;
    }
    // Try to find a Shop by id first, then fall back to matching on displayName -> Shop.name
    let shop = await prisma.shop.findFirst({ where: { id: r.accountId } });
    if (!shop && account.displayName) {
      const normalized = account.displayName.trim().toLowerCase();
      shop = await prisma.shop.findFirst({ where: { name: { equals: account.displayName, mode: 'insensitive' } } });
      if (!shop) {
        // try trimmed lowercase match
        const all = await prisma.shop.findMany({ where: { name: { not: null } }, select: { id: true, name: true } });
        const matched = all.find(s => (s.name || '').trim().toLowerCase() === normalized);
        if (matched) shop = await prisma.shop.findUnique({ where: { id: matched.id } });
      }
    }
    if (!shop) {
      console.warn('No Shop found for MarketplacePayoutWeek.accountId', r.accountId, 'skipping');
      continue;
    }
    if (!account) {
      console.warn('No MarketplaceAccount found for payout week.accountId', r.accountId, 'skipping');
      continue;
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
