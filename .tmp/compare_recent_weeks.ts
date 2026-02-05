import fs from 'fs';

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

async function main() {
  const weeks = Number(process.argv[2] ?? 8);
  const { prisma } = await import('../src/lib/prisma.ts');

  const results: any[] = [];
  const now = new Date();
  // compute canonical current weekStart and then roll back
  const thisWeekStart = canonicalNairobiWeekStartUtc(now);

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(thisWeekStart.getTime() - i * 7 * 24 * 3600 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000 - 1);

    // recompute aggregates for that window
    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: weekEnd } }, { weekEnd: { gte: weekStart } }] } });
    // Aggregate by account + canonical start
    const map = new Map<string, { accountId: string; totalPayout: number; totalGross: number }>();
    for (const r of rows) {
      const cstart = canonicalNairobiWeekStartUtc(new Date(r.weekStart)).toISOString();
      const key = `${r.accountId}::${cstart}`;
      const payout = Number(r.payoutAmount ?? r.grossSales ?? 0);
      const gross = Number(r.grossSales ?? r.payoutAmount ?? 0);
      if (!map.has(key)) map.set(key, { accountId: r.accountId, totalPayout: payout, totalGross: gross });
      else {
        const cur = map.get(key)!;
        cur.totalPayout += payout;
        cur.totalGross += gross;
      }
    }
    const aggs = Array.from(map.values());

    // For each agg, find account displayName and whether a shop exists and weeklySale exists
    const detailed: any[] = [];
    for (const a of aggs) {
      const acct = await prisma.marketplaceAccount.findUnique({ where: { id: a.accountId } });
      const shop = acct?.jumiaShopSid ? await prisma.shop.findFirst({ where: { jumiaShopSid: acct.jumiaShopSid } }) : null;
      const weeklySale = shop ? await prisma.weeklySale.findFirst({ where: { shopId: shop.id, platform: acct?.platform ?? 'JUMIA', weekStart: weekStart } }) : null;
      detailed.push({ accountId: a.accountId, displayName: acct?.displayName ?? null, totalPayout: a.totalPayout, totalGross: a.totalGross, hasShop: !!shop, shopId: shop?.id ?? null, hasWeeklySale: !!weeklySale });
    }

    // weeklySale rows count for that week
    const weeklySales = await prisma.weeklySale.findMany({ where: { weekStart: weekStart } });

    results.push({ weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), aggCount: aggs.length, weeklySaleCount: weeklySales.length, details: detailed });
  }

  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync('.tmp/compare_recent_weeks.json', JSON.stringify({ generatedAt: new Date().toISOString(), weeks: results }, null, 2));
  console.log(`Wrote .tmp/compare_recent_weeks.json — weeks: ${results.length}`);

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => { console.error('compare failed:', e); process.exit(1); });
