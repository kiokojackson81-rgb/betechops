import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { syncOnlineMarketplaceData } from "../src/lib/jobs/onlineSync";
import { backfillWeeklySales } from "./backfill-weekly-sales";

const STATEMENT_LOOKBACK_DAYS = Number(process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS ?? 70);
const BACKFILL_LOOKBACK_DAYS = Number(process.env.WEEKLY_SALES_BACKFILL_LOOKBACK_DAYS ?? 28);

async function main() {
  console.log(
    `[sync-and-backfill-weekly-sales] Fetching payout statements (lookbackDays=${STATEMENT_LOOKBACK_DAYS})...`,
  );
  await syncOnlineMarketplaceData({ lookbackDays: STATEMENT_LOOKBACK_DAYS });
  console.log("[sync-and-backfill-weekly-sales] Payout statements synced.");

  console.log(
    `[sync-and-backfill-weekly-sales] Backfilling WeeklySale rows (lookbackDays=${BACKFILL_LOOKBACK_DAYS})...`,
  );
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
    await prisma.$disconnect().catch(() => undefined);
  });
