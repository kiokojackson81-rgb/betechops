import { pathToFileURL } from 'url';

function parseDateOrNull(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

async function main() {
  const start = parseDateOrNull(process.argv[2]);
  const end = parseDateOrNull(process.argv[3]);
  const windowStart = start ?? new Date(Date.now() - 28 * 24 * 3600 * 1000);
  const windowEnd = end ?? new Date();

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
  console.log(`Found aggregated payout groups: ${aggs.length}`);

  let created = 0;
  for (const a of aggs) {
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: a.accountId } });
    if (!account) continue;
    const shop = account.jumiaShopSid ? await prisma.shop.findFirst({ where: { jumiaShopSid: account.jumiaShopSid } }) : null;
    if (!shop) continue; // only process those with existing shop

    try {
      const amount = Number(a.totalPayout ?? a.totalGross ?? 0);
      await prisma.weeklySale.upsert({
        where: {
          shopId_platform_weekStart_weekEnd: {
            shopId: shop.id,
            platform: account.platform,
            weekStart: a.weekStart,
            weekEnd: a.weekEnd,
          },
        },
        create: {
          shopId: shop.id,
          platform: account.platform,
          weekStart: a.weekStart,
          weekEnd: a.weekEnd,
          amount: amount ?? 0,
          userId: null,
          status: 'PENDING',
          source: 'AUTOMATIC',
          createdBy: null,
        },
        update: { amount: amount ?? 0 },
      });
      created++;
    } catch (e) {
      console.error('Failed upserting', e);
    }
  }

  console.log(`Backfill restricted to existing shops complete. Upserted: ${created}`);
  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error('backfill_only_with_shops failed:', e);
  process.exit(1);
});
