import { PrismaClient } from '@prisma/client';

function canonicalNairobiWeekStartUtc(dateUtc: Date): Date {
  const NAIROBI_OFFSET_MINUTES = 180;
  const nairobiMs = dateUtc.getTime() + NAIROBI_OFFSET_MINUTES * 60_000;
  const nairobi = new Date(nairobiMs);
  const y = nairobi.getUTCFullYear();
  const m = nairobi.getUTCMonth();
  const d = nairobi.getUTCDate();
  const nairobiMidnightUtcMs = Date.UTC(y, m, d, 0, 0, 0) - NAIROBI_OFFSET_MINUTES * 60_000;
  const nairobiLocalMidnight = new Date(nairobiMidnightUtcMs + NAIROBI_OFFSET_MINUTES * 60_000);
  const day = nairobiLocalMidnight.getUTCDay();
  const deltaToMonday = (day + 6) % 7;
  const mondayUtcMs = nairobiMidnightUtcMs - deltaToMonday * 24 * 60 * 60 * 1000;
  return new Date(mondayUtcMs);
}

async function inspectWeek(isoDate: string) {
  const prisma = new PrismaClient();
  const base = new Date(isoDate);
  const canonical = canonicalNairobiWeekStartUtc(base);
  const weekStart = canonical;
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

  const payoutRows = await prisma.marketplacePayoutWeek.findMany({ where: { weekStart } });
  const accountIds = Array.from(new Set(payoutRows.map((r) => r.accountId)));

  const weeklySales = await prisma.weeklySale.findMany({ where: { weekStart } });

  console.log(`Week param: ${isoDate}`);
  console.log(`Canonical weekStart (UTC): ${weekStart.toISOString()} — rows: ${payoutRows.length} accounts: ${accountIds.length}`);
  for (const r of payoutRows) console.log(`- acct=${r.accountId} stmt=${r.statementNumber} payout=${r.payoutAmount}`);
  console.log(`WeeklySale rows: ${weeklySales.length}`);

  await prisma.$disconnect();
}

(async () => {
  try {
    await inspectWeek('2025-12-15');
    await inspectWeek('2025-12-22');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
