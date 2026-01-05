import { prisma } from '@/lib/prisma';
import { upsertWeeklySaleEntry } from '@/lib/jobs/onlineSync';

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
    // Try to find a Shop record matching the account id
    const shop = await prisma.shop.findFirst({ where: { id: r.accountId } });
    if (!shop) {
      console.warn('No Shop found for MarketplacePayoutWeek.accountId', r.accountId, 'skipping');
      continue;
    }
    try {
      await upsertWeeklySaleEntry(shop.id, (await prisma.marketplaceAccount.findUnique({ where: { id: r.accountId } })).platform, r.weekStart, r.weekEnd, Number(r.payoutAmount ?? r.grossSales ?? 0));
      created++;
    } catch (err) {
      console.error('Failed upserting weekly sale for payout week', r.id, err.message || err);
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
