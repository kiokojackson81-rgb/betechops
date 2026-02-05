import fs from 'fs';

function parseDateOrNull(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

async function main() {
  const start = parseDateOrNull(process.argv[2]);
  const end = parseDateOrNull(process.argv[3]);

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

  const windowStart = start ?? new Date(Date.now() - 28 * 24 * 3600 * 1000);
  const windowEnd = end ?? new Date();

  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { AND: [{ weekStart: { lte: windowEnd } }, { weekEnd: { gte: windowStart } }] },
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
  const report: Array<any> = [];
  const missingShopSet = new Set<string>();

  for (const a of aggs) {
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: a.accountId } });
    const jumiaShopSid = account?.jumiaShopSid ?? null;
    const shop = jumiaShopSid ? await prisma.shop.findFirst({ where: { jumiaShopSid } }) : null;
    const entry = {
      accountId: a.accountId,
      jumiaShopSid,
      hasMarketplaceAccount: !!account,
      hasShop: !!shop,
      weekStart: a.weekStart.toISOString(),
      weekEnd: a.weekEnd.toISOString(),
      totalPayout: a.totalPayout,
      totalGross: a.totalGross,
    };
    report.push(entry);
    if (!shop) missingShopSet.add(String(jumiaShopSid));
  }

  const missing = report.filter((r) => !r.hasShop);
  console.log(`Aggregated groups: ${aggs.length}`);
  console.log(`Groups missing Shop: ${missing.length}`);
  if (missing.length > 0) console.table(missing.map((m) => ({ accountId: m.accountId, jumiaShopSid: m.jumiaShopSid })));

  const outPath = '.tmp/missing_shops_report.json';
  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ windowStart: windowStart.toISOString(), windowEnd: windowEnd.toISOString(), totalGroups: aggs.length, missingCount: missing.length, missing }, null, 2));
  console.log(`Wrote report to ${outPath}`);

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error('investigate_missing_shops failed:', e);
  process.exit(1);
});
