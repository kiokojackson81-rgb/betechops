import fs from 'fs';

function parseDateOrNull(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

async function main() {
  const apply = process.env.APPLY === 'true' || process.env.APPLY === '1';
  const start = parseDateOrNull(process.argv[2]);
  const end = parseDateOrNull(process.argv[3]);
  const windowStart = start ?? new Date(Date.now() - 28 * 24 * 3600 * 1000);
  const windowEnd = end ?? new Date();

  const { prisma } = await import('../src/lib/prisma.ts');

  // Load existing missing report if available
  let missing: Array<any> | null = null;
  try {
    const raw = fs.readFileSync('.tmp/missing_shops_report.json', 'utf8');
    const parsed = JSON.parse(raw);
    missing = parsed.missing && parsed.missing.length ? parsed.missing : parsed.proposals?.filter((p: any) => !p.candidates?.length) ?? null;
  } catch (e) {
    missing = null;
  }

  // Fallback: recompute aggregated groups and find missing ones
  if (!missing) {
    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: { AND: [{ weekStart: { lte: windowEnd } }, { weekEnd: { gte: windowStart } }] },
    });
    const map = new Map<string, { accountId: string; weekStart: Date; weekEnd: Date; totalPayout: number; totalGross: number }>();
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
    for (const r of rows) {
      const canonicalStart = canonicalNairobiWeekStartUtc(new Date(r.weekStart));
      const key = `${r.accountId}::${canonicalStart.toISOString()}`;
      const payout = Number(r.payoutAmount ?? r.grossSales ?? 0);
      const gross = Number(r.grossSales ?? r.payoutAmount ?? 0);
      if (!map.has(key)) map.set(key, { accountId: r.accountId, weekStart: canonicalStart, weekEnd: new Date(canonicalStart.getTime() + 7 * 24 * 3600 * 1000 - 1), totalPayout: payout, totalGross: gross });
      else {
        const cur = map.get(key)!;
        cur.totalPayout += payout;
        cur.totalGross += gross;
      }
    }
    const aggs = Array.from(map.values());
    const report: any[] = [];
    for (const a of aggs) {
      const account = await prisma.marketplaceAccount.findUnique({ where: { id: a.accountId } });
      const jumiaShopSid = account?.jumiaShopSid ?? null;
      const shop = jumiaShopSid ? await prisma.shop.findFirst({ where: { jumiaShopSid } }) : null;
      if (!shop) report.push({ accountId: a.accountId, jumiaShopSid, displayName: account?.displayName ?? null });
    }
    missing = report;
  }

  const applied: any[] = [];
  const skipped: any[] = [];

  for (const m of missing) {
    const accountId = m.accountId;
    const jumiaShopSid = m.jumiaShopSid;
    const displayName = m.displayName ?? null;
    if (!jumiaShopSid) {
      skipped.push({ accountId, reason: 'no jumiaShopSid' });
      continue;
    }
    const frag = jumiaShopSid.slice(0, 8).replace(/[^a-zA-Z0-9]/g, '');

    // Heuristic 1: shop name contains jumiaShopSid fragment
    const candByName = await prisma.shop.findMany({ where: { name: { contains: frag, mode: 'insensitive' } }, take: 5 });
    if (candByName.length === 1) {
      const s = candByName[0];
      const willApply = apply && !s.jumiaShopSid;
      if (willApply) {
        await prisma.shop.update({ where: { id: s.id }, data: { jumiaShopSid } });
      }
      applied.push({ accountId, jumiaShopSid, shopId: s.id, method: 'name-frag', applied: willApply });
      continue;
    }

    // Heuristic 2: shop.id === accountId
    const shopById = await prisma.shop.findUnique({ where: { id: accountId } });
    if (shopById) {
      const willApply = apply && !shopById.jumiaShopSid;
      if (willApply) {
        await prisma.shop.update({ where: { id: shopById.id }, data: { jumiaShopSid } });
      }
      applied.push({ accountId, jumiaShopSid, shopId: shopById.id, method: 'shop-id-equals-account', applied: willApply });
      continue;
    }

    // Heuristic 3: shop name contains displayName tokens
    if (displayName) {
      const token = String(displayName).split(/\s+/).find((t) => t.length >= 3);
      if (token) {
        const cand = await prisma.shop.findMany({ where: { name: { contains: token, mode: 'insensitive' } }, take: 5 });
        if (cand.length === 1) {
          const s = cand[0];
          const willApply = apply && !s.jumiaShopSid;
          if (willApply) await prisma.shop.update({ where: { id: s.id }, data: { jumiaShopSid } });
          applied.push({ accountId, jumiaShopSid, shopId: s.id, method: 'name-contains-displayName-token', applied: willApply });
          continue;
        }
      }
    }

    skipped.push({ accountId, jumiaShopSid, reason: 'no high-confidence candidate', candByNameCount: candByName.length });
  }

  const out = { applied, skipped, appliedNow: apply };
  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync('.tmp/auto_mapping_results.json', JSON.stringify(out, null, 2));
  console.log(`Wrote .tmp/auto_mapping_results.json (appliedNow=${apply}). Applied: ${applied.length}. Skipped: ${skipped.length}`);

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error('auto_apply_remaining_mappings failed:', e);
  process.exit(1);
});
