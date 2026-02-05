import { prisma } from "../src/lib/prisma.ts";

function normalizeWeekFromDate(date: Date) {
  const NAIR0BI_OFFSET_HOURS = 3;
  const nairobiMs = date.getTime() + NAIR0BI_OFFSET_HOURS * 3600 * 1000;
  const nairobi = new Date(nairobiMs);
  const y = nairobi.getUTCFullYear();
  const m = nairobi.getUTCMonth() + 1;
  const d = nairobi.getUTCDate();
  const nairobiMidnightUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - NAIR0BI_OFFSET_HOURS * 3600 * 1000;
  const nairobiLocalMidnight = new Date(nairobiMidnightUtcMs + NAIR0BI_OFFSET_HOURS * 3600 * 1000);
  const day = nairobiLocalMidnight.getUTCDay();
  const deltaToMonday = (day + 6) % 7;
  const mondayUtcMs = nairobiMidnightUtcMs - deltaToMonday * 24 * 3600 * 1000;
  const weekStart = new Date(mondayUtcMs);
  const weekEnd = new Date(mondayUtcMs + 7 * 24 * 3600 * 1000 - 1);
  return { weekStart, weekEnd };
}

async function main() {
  const startArg = process.argv[2] || '2025-12-29';
  const endArg = process.argv[3] || '2026-01-04';
  const start = new Date(startArg + 'T00:00:00Z');
  const end = new Date(endArg + 'T23:59:59.999Z');
  console.log('Collapsing duplicate payout rows overlapping', start.toISOString(), end.toISOString());

  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] }, orderBy: { accountId: 'asc' } });

  const groups = new Map<string, { rows: any[], weekStart: Date, weekEnd: Date }>();
  for (const r of rows) {
    // normalize using the stored weekStart as anchor
    const norm = normalizeWeekFromDate(r.weekStart instanceof Date ? r.weekStart : new Date(r.weekStart));
    const key = `${r.accountId}::${norm.weekStart.toISOString()}::${norm.weekEnd.toISOString()}`;
    if (!groups.has(key)) groups.set(key, { rows: [], weekStart: norm.weekStart, weekEnd: norm.weekEnd });
    groups.get(key)!.rows.push(r);
  }

  let created = 0;
  let collapsed = 0;
  for (const [key, g] of groups) {
    if (g.rows.length <= 1) continue;
    // pick keeper prefer non-zero payout
    const keeper = g.rows.find((x) => Number(x.payoutAmount ?? x.grossSales ?? 0) > 0) ?? g.rows[0];
    const others = g.rows.filter((x) => x.id !== keeper.id);
    const aggregated = g.rows.reduce((s, x) => s + Number(x.payoutAmount ?? x.grossSales ?? 0), 0);
    try {
      await prisma.marketplacePayoutWeek.update({ where: { id: keeper.id }, data: { payoutAmount: aggregated, grossSales: aggregated, weekStart: g.weekStart, weekEnd: g.weekEnd } });
      await prisma.marketplacePayoutWeek.deleteMany({ where: { id: { in: others.map((o) => o.id) } } });
      collapsed += others.length;
      console.log(`Collapsed ${others.length} rows into ${keeper.id} for ${keeper.accountId} ${g.weekStart.toISOString()}`);
    } catch (err) {
      console.warn('Failed to collapse duplicate payout rows for', key, err);
    }
  }

  console.log('Done. Collapsed rows:', collapsed);
}

main().catch((e) => { console.error(e); process.exit(1); });
