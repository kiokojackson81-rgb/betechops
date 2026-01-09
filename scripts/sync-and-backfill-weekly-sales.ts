import "dotenv/config";

const STATEMENT_LOOKBACK_DAYS = Number(process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS ?? 70);
const BACKFILL_LOOKBACK_DAYS = Number(process.env.WEEKLY_SALES_BACKFILL_LOOKBACK_DAYS ?? 28);

async function main() {
  console.log(`[sync-and-backfill-weekly-sales] Skipping live payout statement sync (local run).`);
  const [{ prisma }] = await Promise.all([import('../src/lib/prisma.ts')]);

  console.log(`[sync-and-backfill-weekly-sales] Backfilling WeeklySale rows (lookbackDays=${BACKFILL_LOOKBACK_DAYS})...`);
  const { backfillWeeklySales } = await import('./backfill-weekly-sales.ts');
  const result = await backfillWeeklySales({ lookbackDays: BACKFILL_LOOKBACK_DAYS });
  console.log(
    `[sync-and-backfill-weekly-sales] WeeklySale backfill complete. Rows scanned: ${result.rowsScanned}. Upserted: ${result.upserted}.`,
  );
}

main()
  .catch((err) => {
    console.error("[sync-and-backfill-weekly-sales] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      const mod = await import('../src/lib/prisma.ts');
      await mod.prisma.$disconnect().catch(() => undefined);
    } catch (_) {
      // ignore
    }
  });
