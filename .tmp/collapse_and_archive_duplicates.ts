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
  const days = Number(process.argv[2] ?? 90);
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  console.log(`Archiving & collapsing duplicate MarketplacePayoutWeek rows for ${days} days: ${start.toISOString()} -> ${end.toISOString()}`);

  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] }, orderBy: { accountId: 'asc' } });
  console.log('Rows fetched:', rows.length);

  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const base = r.weekStart ?? r.weekEnd ?? new Date();
    const norm = normalizeWeekFromDate(base instanceof Date ? base : new Date(base));
    const key = `${r.accountId}::${norm.weekStart.toISOString()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ row: r, weekStart: norm.weekStart, weekEnd: norm.weekEnd });
  }

  let collapsed = 0;
  for (const [key, items] of groups) {
    if (items.length <= 1) continue;
    // choose keeper: prefer non-zero payoutAmount, else first
    const keeperItem = items.find((i) => Number(i.row.payoutAmount ?? i.row.grossSales ?? 0) > 0) ?? items[0];
    const others = items.filter((i) => i.row.id !== keeperItem.row.id);
    const aggregated = items.reduce((s, it) => s + Number(it.row.payoutAmount ?? it.row.grossSales ?? 0), 0);

    try {
      // ensure archive table exists
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MarketplacePayoutWeek_archive" (LIKE "MarketplacePayoutWeek" INCLUDING ALL)`);
    } catch (err) {
      console.warn('Failed to ensure archive table exists', err);
    }

    // Archive others then delete
    for (const oth of others) {
      try {
        await prisma.$executeRawUnsafe(`INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE id = '${oth.row.id}' AND NOT EXISTS (SELECT 1 FROM "MarketplacePayoutWeek_archive" WHERE id = '${oth.row.id}')`);
        await prisma.marketplacePayoutWeek.delete({ where: { id: oth.row.id } });
      } catch (err) {
        console.warn('Failed to archive/delete row', oth.row.id, err);
      }
    }

    // update keeper with aggregated amounts and canonical week
    try {
      await prisma.marketplacePayoutWeek.update({ where: { id: keeperItem.row.id }, data: { payoutAmount: aggregated, grossSales: aggregated, weekStart: keeperItem.weekStart, weekEnd: keeperItem.weekEnd } });
      collapsed += others.length;
      console.log(`Collapsed ${others.length} into ${keeperItem.row.id} for account ${keeperItem.row.accountId} week ${keeperItem.weekStart.toISOString()}`);
    } catch (err) {
      console.warn('Failed to update keeper row', keeperItem.row.id, err);
    }
  }

  console.log('Done. Collapsed rows:', collapsed);
}

main().catch((e) => { console.error(e); process.exit(1); });
