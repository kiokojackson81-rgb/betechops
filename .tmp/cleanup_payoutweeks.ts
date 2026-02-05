import fs from 'fs';

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
  const apply = process.env.APPLY === 'true' || process.env.APPLY === '1';
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

  // fetch rows overlapping window
  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] }, orderBy: [{ accountId: 'asc' }, { weekStart: 'asc' }] });

  // group by accountId + canonicalStart
  const groups = new Map<string, { accountId: string; canonicalStart: Date; canonicalEnd: Date; rows: any[] }>();
  for (const r of rows) {
    const c = canonicalNairobiWeekStartUtc(new Date(r.weekStart));
    const key = `${r.accountId}::${c.toISOString()}`;
    if (!groups.has(key)) groups.set(key, { accountId: r.accountId, canonicalStart: c, canonicalEnd: new Date(c.getTime() + 7 * 24 * 3600 * 1000 - 1), rows: [] });
    groups.get(key)!.rows.push(r);
  }

  const report: any[] = [];
  const ops: Array<() => Promise<void>> = [];

  for (const [key, g] of groups.entries()) {
    if (g.rows.length <= 1) continue;
    // compute aggregated totals and pick keeper (earliest createdAt or one with >0 payout)
    let keeper = g.rows.find((r: any) => Number(r.payoutAmount ?? r.grossSales ?? 0) > 0) ?? g.rows[0];
    let totalPayout = 0;
    let totalGross = 0;
    const ids: string[] = [];
    for (const r of g.rows) {
      ids.push(r.id);
      totalPayout += Number(r.payoutAmount ?? r.grossSales ?? 0);
      totalGross += Number(r.grossSales ?? r.payoutAmount ?? 0);
    }
    report.push({ accountId: g.accountId, canonicalStart: g.canonicalStart.toISOString(), keeperId: keeper.id, otherIds: ids.filter((id) => id !== keeper.id), totalPayout, totalGross });

    if (apply) {
      // schedule transaction to update keeper and delete others
      ops.push(async () => {
        await prisma.$transaction(async (tx) => {
          await tx.marketplacePayoutWeek.update({ where: { id: keeper.id }, data: { payoutAmount: totalPayout, grossSales: totalGross, weekStart: g.canonicalStart, weekEnd: g.canonicalEnd } });
          const others = ids.filter((id) => id !== keeper.id);
          if (others.length) await tx.marketplacePayoutWeek.deleteMany({ where: { id: { in: others } } });
        });
      });
    }
  }

  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync('.tmp/cleanup_payoutweeks_report.json', JSON.stringify({ applied: apply, entries: report }, null, 2));
  console.log(`Wrote .tmp/cleanup_payoutweeks_report.json — groups: ${report.length} (apply=${apply})`);

  if (apply && ops.length) {
    for (const fn of ops) {
      try { await fn(); } catch (e) { console.error('cleanup op failed:', e); }
    }
    console.log('Cleanup applied.');
  }

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => { console.error('cleanup failed:', e); process.exit(1); });
