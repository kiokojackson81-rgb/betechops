import { prisma } from '../src/lib/prisma';
import { upsertWeeklySaleEntry } from '../src/lib/jobs/onlineSync';
import { recomputeWeeklySummary } from '../src/lib/jobs/recomputeWeeklySummaries';
import { pathToFileURL } from 'url';

export type BackfillWeeklySalesOptions = {
  lookbackDays?: number;
};

export type BackfillWeeklySalesResult = {
  rowsScanned: number;
  upserted: number;
};

export async function backfillWeeklySales(opts?: BackfillWeeklySalesOptions): Promise<BackfillWeeklySalesResult> {
  const lookbackDays = opts?.lookbackDays ?? 28;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  // Use grouped aggregates per account/week to avoid duplicate rows
  const aggs = await recomputeWeeklySummary(cutoff, new Date());
  console.log(`[backfill-weekly-sales] Found aggregated payout groups to backfill: ${aggs.length} (lookbackDays=${lookbackDays})`);

  let created = 0;
  for (const r of aggs) {
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: r.accountId } });
    if (!account) {
      console.warn('No MarketplaceAccount found for payout agg.accountId', r.accountId, 'skipping');
      continue;
    }
    const shop = await prisma.shop.findFirst({ where: { jumiaShopSid: account.jumiaShopSid } });
    if (!shop) {
      console.warn('No Shop found for MarketplaceAccount.jumiaShopSid', account.jumiaShopSid, 'skipping');
      continue;
    }
    try {
      await upsertWeeklySaleEntry(shop.id, account.platform, r.weekStart, r.weekEnd, Number(r.totalPayout ?? r.totalGross ?? 0));
      created++;
    } catch (err) {
      console.error('Failed upserting weekly sale for payout agg', r.accountId, String(err));
    }
  }

  return { rowsScanned: rows.length, upserted: created };
}

async function run(): Promise<void> {
  const lookbackDays = Number(process.env.WEEKLY_SALES_BACKFILL_LOOKBACK_DAYS ?? 28);
  const result = await backfillWeeklySales({ lookbackDays });
  console.log(`[backfill-weekly-sales] Backfill complete. Rows scanned: ${result.rowsScanned}. Upserted/updated: ${result.upserted}.`);
}

const entryScriptUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
const isExecutedDirectly = entryScriptUrl === import.meta.url;

if (isExecutedDirectly) {
  run()
    .catch((err) => {
      console.error('[backfill-weekly-sales] Failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => undefined);
    });
}
