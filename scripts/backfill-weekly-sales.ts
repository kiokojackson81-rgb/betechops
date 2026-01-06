import { pathToFileURL } from 'url';
import { WeeklySaleSource, WeeklySaleStatus } from '@prisma/client';

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

  // Recompute aggregation locally (avoid importing other project modules that use path aliases)
  function canonicalNairobiWeekStartUtc(dateUtc: Date): Date {
    const NAIR0BI_OFFSET_HOURS = 3;
    const nairobiMs = dateUtc.getTime() + NAIR0BI_OFFSET_HOURS * 3600 * 1000;
    const nairobi = new Date(nairobiMs);
    const y = nairobi.getUTCFullYear();
    const m = nairobi.getUTCMonth();
    const d = nairobi.getUTCDate();
    const nairobiMidnightUtcMs = Date.UTC(y, m, d, 0, 0, 0) - NAIR0BI_OFFSET_HOURS * 3600 * 1000;
    const nairobiLocalMidnight = new Date(nairobiMidnightUtcMs + NAIR0BI_OFFSET_HOURS * 3600 * 1000);
    const day = nairobiLocalMidnight.getUTCDay();
    const deltaToMonday = (day + 6) % 7;
    const mondayUtcMs = nairobiMidnightUtcMs - deltaToMonday * 24 * 3600 * 1000;
    return new Date(mondayUtcMs);
  }

  // Fetch payout rows overlapping the requested window and aggregate by account + canonical weekStart
  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { AND: [{ weekStart: { lte: new Date() } }, { weekEnd: { gte: cutoff } }] },
  });
  const map = new Map<string, { accountId: string; weekStart: Date; weekEnd: Date; totalPayout: number; totalGross: number }>();
  for (const r of rows) {
    const canonicalStart = canonicalNairobiWeekStartUtc(new Date(r.weekStart));
    const canonicalEnd = new Date(canonicalStart.getTime() + 7 * 24 * 3600 * 1000 - 1);
    const key = `${r.accountId}::${canonicalStart.toISOString()}`;
    const payout = Number(r.payoutAmount ?? r.grossSales ?? 0);
    const gross = Number(r.grossSales ?? r.payoutAmount ?? 0);
    if (!map.has(key)) {
      map.set(key, { accountId: r.accountId, weekStart: canonicalStart, weekEnd: canonicalEnd, totalPayout: payout, totalGross: gross });
    } else {
      const cur = map.get(key)!;
      cur.totalPayout += payout;
      cur.totalGross += gross;
    }
  }
  const aggs = Array.from(map.values());
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
      const amount = Number(r.totalPayout ?? r.totalGross ?? 0);
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
          amount: amount ?? 0,
          userId: null,
          status: WeeklySaleStatus.PENDING,
          source: WeeklySaleSource.AUTOMATIC,
          createdBy: null,
        },
        update: {
          amount: amount ?? 0,
        },
      });
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
