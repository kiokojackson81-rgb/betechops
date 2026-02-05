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

  const map = new Map<string, { accountId: string; weekStart: Date }>();
  for (const r of rows) {
    const canonicalStart = canonicalNairobiWeekStartUtc(new Date(r.weekStart));
    const key = `${r.accountId}::${canonicalStart.toISOString()}`;
    if (!map.has(key)) map.set(key, { accountId: r.accountId, weekStart: canonicalStart });
  }

  const aggs = Array.from(map.values());

  const report: Array<any> = [];

  for (const a of aggs) {
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: a.accountId } });
    const jumiaShopSid = account?.jumiaShopSid ?? null;
    if (!jumiaShopSid) continue;
    const existingShop = await prisma.shop.findFirst({ where: { jumiaShopSid } });
    if (existingShop) continue; // already mapped

    // Search for candidate shops by various heuristics
    const candidates: Array<any> = [];

    const normalized = jumiaShopSid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // Exact normalized jumiaShopSid match
    const exactCandidates = await prisma.shop.findMany({ where: { jumiaShopSid: { contains: normalized } }, take: 5 });
    exactCandidates.forEach((s) => candidates.push({ type: 'jumiaSidContains', shop: s }));

    // Search by name fragments (first 6 chars)
    const frag = jumiaShopSid.slice(0, 6).replace(/[^a-zA-Z0-9]/g, '');
    if (frag.length >= 3) {
      const nameMatches = await prisma.shop.findMany({ where: { name: { contains: frag, mode: 'insensitive' } }, take: 5 });
      nameMatches.forEach((s) => candidates.push({ type: 'nameContainsFrag', shop: s }));
    }

    // Search marketplaceAccount table for jumiaShopSid variants
    const accountVariants = await prisma.marketplaceAccount.findMany({ where: { jumiaShopSid: { contains: normalized } }, take: 5 });
    accountVariants.forEach((acc) => candidates.push({ type: 'accountVariant', account: acc }));

    report.push({ accountId: a.accountId, jumiaShopSid, candidates });
  }

  const outPath = '.tmp/proposed_shop_mappings.json';
  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ windowStart: windowStart.toISOString(), windowEnd: windowEnd.toISOString(), proposals: report }, null, 2));
  console.log(`Wrote proposed mappings to ${outPath}. Proposals: ${report.length}`);

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error('propose_shop_mappings failed:', e);
  process.exit(1);
});
