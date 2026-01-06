import { prisma } from "../src/lib/prisma";
import { upsertWeeklySaleEntry } from "../src/lib/jobs/onlineSync";
import recomputeWeeklySummary from "../src/lib/jobs/recomputeWeeklySummaries";

async function main() {
  const lookbackDays = Number(process.env.WEEKLY_SALES_BACKFILL_LOOKBACK_DAYS ?? 28);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const aggs = await recomputeWeeklySummary(cutoff, new Date());
  console.log(`[backfill-weekly-sales] Aggregated payout groups to backfill: ${aggs.length} (lookbackDays=${lookbackDays})`);

  let created = 0;
  for (const a of aggs) {
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: a.accountId } });
    if (!account) {
      console.warn('No MarketplaceAccount found for payout agg.accountId', a.accountId);
      continue;
    }
    const shop = (await prisma.shop.findFirst({ where: { jumiaShopSid: account.jumiaShopSid } })) ?? (await prisma.shop.findUnique({ where: { id: account.id } }));
    if (!shop) {
      console.warn('No Shop found for MarketplaceAccount.jumiaShopSid', account.jumiaShopSid, 'skipping');
      continue;
    }
    try {
      await upsertWeeklySaleEntry(shop.id, account.platform, a.weekStart, a.weekEnd, Number(a.totalPayout ?? a.totalGross ?? 0));
      created++;
    } catch (err) {
      console.error('Failed upserting weekly sale for payout agg', a.accountId, String(err));
    }
  }

  console.log(`[backfill-weekly-sales] Backfill complete. Upserted/updated: ${created}`);
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
