// scripts/fix_commission_ledger.ts
// Idempotent script to recompute and (optionally) upsert commissionLedger
// for a given period range. Dry-run by default.

// Attempt to load project env helper if present. This is optional —
// missing the module should not prevent the script from running.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("./../src/lib/env");
} catch (e) {
  // ignore if env loader is not present in this environment
}
import { prisma } from "../src/lib/prisma";
import {
  getOrCreateCommissionPeriod,
  computeSalesCommissionFromTiers,
  computeProductCommissions,
} from "../src/lib/commission";
import { getTradingPeriodFor } from "../src/lib/tradingPeriod";

async function main() {
  const periodStart = process.env.PERIOD_START;
  const periodEnd = process.env.PERIOD_END;
  const dryRun = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";

  if (!periodStart || !periodEnd) {
    console.error("Usage: PERIOD_START=2025-11-25 PERIOD_END=2025-12-24 DRY_RUN=true ts-node scripts/fix_commission_ledger.ts");
    process.exit(1);
  }

  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  console.log(`Period start: ${start.toISOString()}  end: ${end.toISOString()}  dryRun: ${dryRun}`);

  // find commission ledger rows for this period
  const ledgers = await prisma.commissionLedger.findMany({
    where: { periodStart: start, periodEnd: end },
    select: { id: true, userId: true, grossCommission: true, netCommission: true },
  });

  console.log(`Found ${ledgers.length} commission ledger rows for the period.`);

  // If none found, optionally compute for all attendants who had snapshots/reports in range
  const userIds = ledgers.map((l) => l.userId);

  for (const userId of userIds) {
    console.log(`\nProcessing attendant ${userId}`);

    // Recompute totals similar to attendant route
    const snapshots = await prisma.profitSnapshot.findMany({
      where: {
        orderItem: {
          order: {
            attendantId: userId,
            createdAt: { gte: start, lte: end },
          },
        },
      },
      select: { revenue: true, profit: true },
    });

    let totalSales = 0;
    let totalProfit = 0;
    for (const s of snapshots) {
      totalSales += Number(s.revenue ?? 0);
      totalProfit += Number(s.profit ?? 0);
    }

    const reports = await prisma.dailyReport.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { newProducts: true, productsEdited: true, copiesUploaded: true },
    });

    let newProducts = 0;
    let editedProducts = 0;
    let copiedProducts = 0;
    for (const r of reports) {
      newProducts += r.newProducts ?? 0;
      editedProducts += r.productsEdited ?? 0;
      copiedProducts += r.copiesUploaded ?? 0;
    }

    const { period, tiers } = await getOrCreateCommissionPeriod(new Date(start));

    // Use default fallback (no explicit 0) to match attendant behaviour
    const salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers);
    const { newProductCommission, copiedCommission, editedCommission } = computeProductCommissions({
      newProducts,
      copiedProducts,
      editedProducts,
    });

    const grossCommission = salesCommission + newProductCommission + copiedCommission + editedCommission;

    const detail = {
      periodKey: `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`,
      totalSales,
      totalProfit,
      salesCommission,
      newProductCommission,
      copiedCommission,
      editedCommission,
      totalNewProducts: newProducts,
      totalEditedProducts: editedProducts,
      totalCopiedProducts: copiedProducts,
    };

    console.log(`Computed grossCommission=${grossCommission} (previous grossCommission available in DB)`);

    if (!dryRun) {
      await prisma.commissionLedger.upsert({
        where: {
          userId_periodStart_periodEnd: {
            userId,
            periodStart: start,
            periodEnd: end,
          },
        },
        update: {
          grossCommission: grossCommission.toString(),
          netCommission: grossCommission.toString(),
          detail,
        },
        create: {
          userId,
          periodStart: start,
          periodEnd: end,
          grossCommission: grossCommission.toString(),
          netCommission: grossCommission.toString(),
          detail,
        },
      });
      console.log(`Upserted commissionLedger for ${userId}`);
    } else {
      console.log(`Dry-run: not persisting changes for ${userId}`);
    }
  }

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
