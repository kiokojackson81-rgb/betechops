import { prisma } from '../src/lib/prisma';
import { upsertWeeklySaleEntry } from '../src/lib/jobs/onlineSync';
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

  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { weekEnd: { gte: cutoff } },
    orderBy: { weekEnd: 'desc' },
  });

  console.log(`[backfill-weekly-sales] Found payout weeks to backfill: ${rows.length} (lookbackDays=${lookbackDays})`);

  let created = 0;
  for (const r of rows) {
    const shop = await prisma.shop.findFirst({ where: { id: r.accountId } });
    if (!shop) {
      console.warn('No Shop found for MarketplacePayoutWeek.accountId', r.accountId, 'skipping');
      continue;
    }
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: r.accountId } });
    if (!account) {
      console.warn('No MarketplaceAccount found for payout week.accountId', r.accountId, 'skipping');
      continue;
    }
    try {
      await upsertWeeklySaleEntry(shop.id, account.platform, r.weekStart, r.weekEnd, Number(r.payoutAmount ?? r.grossSales ?? 0));
      created++;
    } catch (err) {
      console.error('Failed upserting weekly sale for payout week', r.id, String(err));
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
