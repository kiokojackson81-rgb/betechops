/**
 * Backfill JumiaOrder totals by forcing a wide lookback incremental sync.
 * This re-calls the vendor /orders endpoint for a historical window and lets
 * existing upsert logic populate `totalAmountLocalCurrency` and `totalAmountLocalValue`.
 *
 * Env vars:
 *   LOOKBACK_DAYS (default 180)
 *   SHOP_ID (optional - limit to one Jumia shop id)
 *   DRY_RUN=1 (log only, no DB writes) -- implemented by skipping upsert
 */
// Dynamic ESM imports to avoid Node resolution issues with .ts extension
let syncOrdersIncremental: any;
let prisma: any;
async function loadDeps() {
  if (!syncOrdersIncremental) {
    const jobsMod = await import('../src/lib/jobs/jumia.ts');
    syncOrdersIncremental = jobsMod.syncOrdersIncremental;
  }
  if (!prisma) {
    const prismaMod = await import('../src/lib/prisma.ts');
    prisma = prismaMod.prisma;
  }
}

const LOOKBACK_DAYS = Number(process.env.LOOKBACK_DAYS || 180);
const SHOP_ID = process.env.SHOP_ID || null;
const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  await loadDeps();
  console.log(`[resync-backfill] starting lookback=${LOOKBACK_DAYS} shop=${SHOP_ID || 'ALL'} dryRun=${DRY_RUN}`);
  if (DRY_RUN) {
    console.log('[resync-backfill] DRY_RUN – will invoke syncOrdersIncremental but skip writes by wrapping prisma in a proxy');
    // Monkey-patch prisma.jumiaOrder.upsert to no-op for safety
    const originalUpsert = prisma.jumiaOrder.upsert.bind(prisma.jumiaOrder);
    prisma.jumiaOrder.upsert = (args: any) => {
      console.log('[resync-backfill] DRY_RUN upsert skipped id=', args?.where?.id);
      return Promise.resolve({});
    };
    try {
      const summary = await syncOrdersIncremental({ shopId: SHOP_ID || undefined, lookbackDays: LOOKBACK_DAYS });
      console.log('[resync-backfill] summary', summary);
    } finally {
      prisma.jumiaOrder.upsert = originalUpsert; // restore
    }
  } else {
    const summary = await syncOrdersIncremental({ shopId: SHOP_ID || undefined, lookbackDays: LOOKBACK_DAYS });
    console.log('[resync-backfill] summary', summary);
  }
  // Count remaining missing totals
  const missing = await prisma.jumiaOrder.count({ where: { OR: [ { totalAmountLocalValue: null }, { totalAmountLocalCurrency: null } ] } });
  console.log(`[resync-backfill] remaining rows missing totals = ${missing}`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('[resync-backfill] fatal error', err);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});

export {}; // ensure this file is treated as a module
