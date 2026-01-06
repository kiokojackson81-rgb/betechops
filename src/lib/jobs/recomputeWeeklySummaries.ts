import { prisma } from "../prisma";

export type WeeklyAggregate = {
  accountId: string;
  weekStart: Date;
  weekEnd: Date;
  totalPayout: number;
  totalGross: number;
};

export async function recomputeWeeklySummary(weekStart: Date, weekEnd: Date): Promise<WeeklyAggregate[]> {
  // Fetch rows overlapping the requested window and aggregate by accountId + weekStart + weekEnd
  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { AND: [{ weekStart: { lte: weekEnd } }, { weekEnd: { gte: weekStart } }] },
  });

  const map = new Map<string, WeeklyAggregate>();
  for (const r of rows) {
    const key = `${r.accountId}::${r.weekStart.toISOString()}::${r.weekEnd.toISOString()}`;
    const payout = Number(r.payoutAmount ?? r.grossSales ?? 0);
    const gross = Number(r.grossSales ?? r.payoutAmount ?? 0);
    if (!map.has(key)) {
      map.set(key, { accountId: r.accountId, weekStart: r.weekStart, weekEnd: r.weekEnd, totalPayout: payout, totalGross: gross });
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
