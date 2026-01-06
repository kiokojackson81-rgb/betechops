import { prisma } from "../prisma";

export type WeeklyAggregate = {
  accountId: string;
  weekStart: Date;
  weekEnd: Date;
  totalPayout: number;
  totalGross: number;
};

// Helper: interpret a UTC timestamp as Nairobi local time and return the
// canonical UTC Monday midnight for that Nairobi-local week. This matches
// the canonicalization used during ingestion (getJumiaWeeklyPeriodFor).
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

export async function recomputeWeeklySummary(weekStart: Date, weekEnd: Date): Promise<WeeklyAggregate[]> {
  // Fetch rows overlapping the requested window
  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { AND: [{ weekStart: { lte: weekEnd } }, { weekEnd: { gte: weekStart } }] },
  });

  // Aggregate by accountId + canonical Nairobi weekStart
  const map = new Map<string, WeeklyAggregate>();
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

  return Array.from(map.values());
}

export async function uniqueAccountCountForWindow(weekStart: Date, weekEnd: Date): Promise<number> {
  const aggs = await recomputeWeeklySummary(weekStart, weekEnd);
  const unique = new Set(aggs.map((a) => a.accountId));
  return unique.size;
}

export default recomputeWeeklySummary;
