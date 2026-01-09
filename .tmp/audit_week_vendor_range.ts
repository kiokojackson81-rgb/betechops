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

function parseDate(s?: string): Date {
  if (!s) throw new Error('missing date arg YYYY-MM-DD');
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error('invalid date');
  return d;
}

async function main() {
  const arg = process.argv[2] ?? '2025-12-21';
  const startLocal = parseDate(arg);
  // compute canonical Nairobi weekStart from provided date
  const canonicalStart = canonicalNairobiWeekStartUtc(startLocal);
  const canonicalEnd = new Date(canonicalStart.getTime() + 7 * 24 * 3600 * 1000 - 1);

  const { prisma } = await import('../src/lib/prisma.ts');

  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: canonicalEnd } }, { weekEnd: { gte: canonicalStart } }] }, orderBy: [{ accountId: 'asc' }, { createdAt: 'asc' }] });

  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const cstart = canonicalNairobiWeekStartUtc(new Date(r.weekStart)).toISOString();
    const key = `${r.accountId}::${cstart}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const results: any[] = [];
  for (const [key, items] of groups.entries()) {
    const [accountId, startIso] = key.split('::');
    if (startIso !== canonicalStart.toISOString()) continue;
    items.sort((a, b) => {
      const aAmt = Number(a.payoutAmount ?? a.grossSales ?? 0);
      const bAmt = Number(b.payoutAmount ?? b.grossSales ?? 0);
      if ((aAmt > 0) !== (bAmt > 0)) return aAmt > 0 ? -1 : 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const keeper = items[0];
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: accountId } });
    const shop = account?.jumiaShopSid ? await prisma.shop.findFirst({ where: { jumiaShopSid: account.jumiaShopSid } }) : null;
    results.push({ accountId, displayName: account?.displayName ?? null, jumiaShopSid: account?.jumiaShopSid ?? null, shopId: shop?.id ?? null, statementId: keeper.id, statementNumber: keeper.statementNumber, amount: Number(keeper.payoutAmount ?? keeper.grossSales ?? 0), createdAt: keeper.createdAt, rawShopSid: keeper.rawPayload?.shopSid ?? null });
  }

  results.sort((a, b) => b.amount - a.amount);
  fs.mkdirSync('.tmp', { recursive: true });
  const outPath = `.tmp/week_${arg}_vendor_audit.json`;
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), weekStart: canonicalStart.toISOString(), weekEnd: canonicalEnd.toISOString(), rows: results }, null, 2));
  console.log(`Wrote ${outPath} — accounts: ${results.length}`);
  for (const r of results) console.log(`- ${r.displayName ?? r.accountId}: amount=Ksh ${Number(r.amount).toFixed(2)} stmt=${r.statementNumber} shopSid=${r.jumiaShopSid ?? r.rawShopSid}`);

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => { console.error('audit_range failed', e); process.exit(1); });
