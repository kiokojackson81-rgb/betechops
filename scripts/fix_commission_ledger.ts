// scripts/fix_commission_ledger.ts
// Idempotent script to recompute and (optionally) upsert commissionLedger
// for a given period range. Dry-run by default.
export {};

// Attempt to load project env helper if present. This is optional —
// missing the module should not prevent the script from running.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("./../src/lib/env");
} catch (e) {
  // ignore if env loader is not present in this environment
}

// Use a fresh Prisma client here to avoid importing project internals
// which may not resolve cleanly in this script runner.
let PrismaClient: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  PrismaClient = require("@prisma/client").PrismaClient;
} catch (err) {
  console.error("Missing dependency '@prisma/client'. Run `npm install` or `npm ci` in the project root and try again.");
  process.exit(1);
}
const prisma = new PrismaClient();

const isRecord = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);

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

  // Gather attendants who have support entries in this period (we will upsert ledgers for them)
  const attendants = await prisma.supportDailyEntry.findMany({
    where: { date: { gte: start, lte: end } },
    select: { submittedById: true },
  });

  const userIds = Array.from(new Set(attendants.map((a: { submittedById?: string | null }) => a.submittedById).filter(Boolean)));

  for (const userId of userIds) {
    console.log(`\nProcessing attendant ${userId}`);

    // Summarize support entries for this attendant in the period
    const entries = await prisma.supportDailyEntry.findMany({
      where: { submittedById: userId, date: { gte: start, lte: end } },
      select: {
        totalSales: true,
        totalProfit: true,
        newBatteries: true,
        changedBatteries: true,
        receipts: { select: { _count: { select: { items: true } } } },
      },
    });

    let totalSales = 0;
    let totalProfit = 0;
    let totalReceipts = 0;
    let totalItems = 0;
    let newBatteries = 0;
    let changedBatteries = 0;
    for (const e of entries) {
      totalSales += Number(e.totalSales ?? 0);
      totalProfit += Number(e.totalProfit ?? 0);
      totalReceipts += 1;
      totalItems += Number(e.receipts?._count?.items ?? 0);
      newBatteries += Number(e.newBatteries ?? 0);
      changedBatteries += Number(e.changedBatteries ?? 0);
    }

    const supportCommission = Math.max(0, Math.round(totalProfit * 0.05));

    // Merge with any existing ledger entry to avoid clobbering other sections
    const existingLedger = await prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId,
          periodStart: start,
          periodEnd: end,
        },
      },
    });

    const detailValue = existingLedger?.detail;
    const existingDetail = isRecord(detailValue) ? { ...detailValue } : {};
    const previousSupport = isRecord(existingDetail.support) ? existingDetail.support : null;
    const previousSupportCommission =
      typeof previousSupport?.commission === "number"
        ? previousSupport.commission
        : Number(existingDetail.supportCommission ?? 0);

    const baseGross = Math.max(0, Number(existingLedger?.grossCommission ?? 0) - Number(previousSupportCommission ?? 0));
    const grossCommission = baseGross + supportCommission;
    const penalties = Number(existingLedger?.penalties ?? 0);
    const netCommission = grossCommission - penalties;

    const nextDetail = {
      ...existingDetail,
      support: {
        periodKey: `${start.toISOString().split("T")[0]}_${end.toISOString().split("T")[0]}`,
        totals: { totalSales, totalProfit, totalReceipts, totalItems, newBatteries, changedBatteries },
        commission: supportCommission,
        computedAt: new Date().toISOString(),
      },
      supportCommission,
    };

    console.log(`Computed supportCommission=${supportCommission} (previousSupportCommission=${previousSupportCommission})`);

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
          netCommission: netCommission.toString(),
          detail: nextDetail,
        },
        create: {
          userId,
          periodStart: start,
          periodEnd: end,
          grossCommission: grossCommission.toString(),
          netCommission: netCommission.toString(),
          detail: nextDetail,
        },
      });
      console.log(`Upserted commissionLedger for ${userId}`);
    } else {
      console.log(`Dry-run: would upsert commissionLedger for ${userId} with supportCommission=${supportCommission}`);
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
