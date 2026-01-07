import { pathToFileURL } from 'url';
import { WeeklySaleSource, WeeklySaleStatus } from '@prisma/client';
import { canonicalNairobiWeekStartUtc } from '../src/lib/weekWindow.ts';
import { chooseAuthoritativeCandidate } from '../src/lib/payoutWeekDedupe.ts';

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
  // Dynamically import heavy ESM modules at runtime to avoid loader/cycle issues
  const [{ prisma }] = await Promise.all([import('../src/lib/prisma.ts')]);
  const { upsertWeeklySaleEntry } = await import('../src/lib/jobs/onlineSync.ts');

  // Fetch payout rows overlapping the requested window and aggregate by account + canonical weekStart
  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { AND: [{ weekStart: { lte: new Date() } }, { weekEnd: { gte: cutoff } }] },
  });
  type PayoutRow = (typeof rows)[number];
  const grouped = new Map<
    string,
    {
      accountId: string;
      weekStart: Date;
      weekEnd: Date;
      rows: PayoutRow[];
    }
  >();
  for (const r of rows) {
    const canonicalStart = canonicalNairobiWeekStartUtc(new Date(r.weekStart));
    const canonicalEnd = new Date(canonicalStart.getTime() + 7 * 24 * 3600 * 1000 - 1);
    const key = `${r.accountId}::${canonicalStart.toISOString()}`;
    const entry = grouped.get(key) ?? { accountId: r.accountId, weekStart: canonicalStart, weekEnd: canonicalEnd, rows: [] };
    entry.rows.push(r);
    grouped.set(key, entry);
  }
  const aggs = Array.from(grouped.values());
  console.log(`[backfill-weekly-sales] Found aggregated payout groups to backfill: ${aggs.length} (lookbackDays=${lookbackDays})`);

  let created = 0;
  const rowsScanned = aggs.length;
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
      const best = chooseAuthoritativeCandidate(r.rows, r.weekStart);
      if (!best) {
        continue;
      }
      const amount = Number(best.payoutAmount ?? best.grossSales ?? 0);
      // Use the centralized upsert helper which preserves manual overrides
      await upsertWeeklySaleEntry(shop.id, account.platform, r.weekStart, r.weekEnd, amount);
      created++;
    } catch (err) {
      console.error('Failed upserting weekly sale for payout agg', r.accountId, String(err));
    }
  }

  return { rowsScanned, upserted: created };
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
      try {
        const { prisma } = await import('../src/lib/prisma.ts');
        await prisma.$disconnect().catch(() => undefined);
      } catch (e) {
        // ignore
      }
    });
}
