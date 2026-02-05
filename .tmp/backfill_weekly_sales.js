const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);

  // Aggregate by accountId + canonical weekStart/weekEnd to avoid duplicates
  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { weekEnd: { gte: cutoff } } });
  console.log('Found payout rows to aggregate:', rows.length);

  const groups = new Map();
  for (const r of rows) {
    const wkStart = new Date(r.weekStart).toISOString();
    const wkEnd = new Date(r.weekEnd).toISOString();
    const key = `${r.accountId}::${wkStart}::${wkEnd}`;
    groups.set(key, (groups.get(key) || 0) + Number(r.payoutAmount ?? r.grossSales ?? 0));
  }

  console.log('Aggregated payout groups to backfill:', groups.size);
  let created = 0;
  for (const [key, amt] of groups.entries()) {
    const [accountId, wkStartIso, wkEndIso] = key.split('::');
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      console.warn('No MarketplaceAccount found for accountId', accountId, 'skipping');
      continue;
    }
    const shop = await prisma.shop.findFirst({ where: { jumiaShopSid: account.jumiaShopSid } }) || await prisma.shop.findUnique({ where: { id: accountId } });
    if (!shop) {
      console.warn('No Shop found for MarketplaceAccount.jumiaShopSid', account.jumiaShopSid, 'skipping');
      continue;
    }
    try {
      await prisma.weeklySale.upsert({
        where: { shopId_platform_weekStart_weekEnd: { shopId: shop.id, platform: account.platform, weekStart: new Date(wkStartIso), weekEnd: new Date(wkEndIso) } },
        create: { shopId: shop.id, platform: account.platform, weekStart: new Date(wkStartIso), weekEnd: new Date(wkEndIso), amount: Number(amt || 0), userId: null, status: 'PENDING', source: 'AUTOMATIC', createdBy: null },
        update: { amount: Number(amt || 0) },
      });
      created++;
    } catch (err) {
      console.error('Failed upserting weekly sale for payout group', key, String(err));
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
