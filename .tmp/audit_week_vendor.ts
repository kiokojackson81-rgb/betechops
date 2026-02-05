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
  const start = new Date('2025-12-29T00:00:00.000Z');
  const end = new Date('2026-01-04T23:59:59.999Z');
  const { prisma } = await import('../src/lib/prisma.ts');

  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] }, orderBy: [{ accountId: 'asc' }, { createdAt: 'asc' }] });

  // group by account + canonical start
  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const cstart = canonicalNairobiWeekStartUtc(new Date(r.weekStart)).toISOString();
    const key = `${r.accountId}::${cstart}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const targetCanonical = canonicalNairobiWeekStartUtc(start).toISOString();
  const results: any[] = [];
  for (const [key, items] of groups.entries()) {
    const [accountId, startIso] = key.split('::');
    if (startIso !== targetCanonical) continue;
    // choose authoritative row: prefer non-zero payout, earliest createdAt
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

  // sort by amount desc
  results.sort((a, b) => b.amount - a.amount);

  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync('.tmp/week_2025-12-29_vendor_audit.json', JSON.stringify({ generatedAt: new Date().toISOString(), weekStart: start.toISOString(), weekEnd: end.toISOString(), rows: results }, null, 2));

  console.log(`Wrote .tmp/week_2025-12-29_vendor_audit.json — accounts: ${results.length}`);
  for (const r of results) console.log(`- ${r.displayName ?? r.accountId}: amount=Ksh ${Number(r.amount).toFixed(2)} stmt=${r.statementNumber} shopSid=${r.jumiaShopSid ?? r.rawShopSid}`);

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => { console.error('audit failed', e); process.exit(1); });
