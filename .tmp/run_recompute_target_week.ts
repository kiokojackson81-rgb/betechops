import { pathToFileURL } from 'url';

function parseDateOrExit(s: string | undefined, name: string): Date {
  if (!s) {
    console.error(`Missing ${name} argument`);
    process.exit(2);
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) {
    console.error(`Invalid ${name} date: ${s}`);
    process.exit(2);
  }
  return d;
}

async function main() {
  const start = parseDateOrExit(process.argv[2], 'start');
  const end = parseDateOrExit(process.argv[3], 'end');

  const { prisma } = await import('../src/lib/prisma.ts');

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

  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] },
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
  let totalPayout = 0;
  let totalGross = 0;
  for (const a of aggs) {
    totalPayout += a.totalPayout;
    totalGross += a.totalGross;
  }

  console.log(`Unique account groups: ${aggs.length}`);
  for (const a of aggs) {
    console.log(`${a.accountId}: payout=${a.totalPayout.toFixed(2)} gross=${a.totalGross.toFixed(2)}`);
  }
  console.log(`Totals: payout= ${totalPayout.toFixed(2)} gross= ${totalGross.toFixed(2)}`);
  const uniqueAccounts = new Set(aggs.map((a) => a.accountId));
  console.log(`Unique account count (per week grouping): ${uniqueAccounts.size}`);

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error('Runner failed:', e);
  process.exit(1);
});
