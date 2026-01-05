const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2] || '2025-12-28';
  // Parse YYYY-MM-DD as UTC midnight to avoid local TZ shifts
  const [y, m, d] = arg.split('-').map((s) => Number(s));
  const weekStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  console.log('Reconciling week:', weekStart.toISOString().split('T')[0], '->', weekEnd.toISOString().split('T')[0]);

  // Find any payout weeks that overlap this window (inclusive)
  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [ { weekStart: { gte: weekStart } }, { weekEnd: { lte: weekEnd } } ] }, orderBy: { accountId: 'asc' } });
  console.log('MarketplacePayoutWeek rows found:', rows.length);

  let totalGross = 0;
  let totalPayout = 0;
  const byStatement = new Map();
  const missingShopSids = new Set();
  for (const r of rows) {
    totalGross += Number(r.grossSales ?? 0);
    totalPayout += Number(r.payoutAmount ?? r.grossSales ?? 0);
    const sn = r.statementNumber ?? '(none)';
    if (!byStatement.has(sn)) byStatement.set(sn, []);
    byStatement.get(sn).push(r);
    const sid = r.rawPayload?.shopSid ?? null;
    if (sid) {
      const acct = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: sid } });
      if (!acct) missingShopSids.add(sid);
    }
  }

  const duplicates = [];
  for (const [sn, arr] of byStatement.entries()) {
    if (arr.length > 1) duplicates.push({ statementNumber: sn, count: arr.length, rows: arr.map(x => ({ id: x.id, accountId: x.accountId, grossSales: Number(x.grossSales ?? 0) })) });
  }

  const weeklySale = await prisma.weeklySale.aggregate({ _sum: { amount: true }, where: { platform: 'JUMIA', weekStart, weekEnd } });
  const weeklySum = weeklySale._sum.amount ?? 0;

  console.log('\nSummary');
  console.log('- Total grossSales (MarketplacePayoutWeek):', totalGross.toFixed(2));
  console.log('- Total payoutAmount (MarketplacePayoutWeek):', totalPayout.toFixed(2));
  console.log('- WeeklySale total (platform=JUMIA):', Number(weeklySum).toFixed(2));
  console.log('- Statement count:', rows.length);
  console.log('- Duplicate statementNumbers:', duplicates.length);
  console.log('- Missing shopSids (present in raw payload but no MarketplaceAccount):', missingShopSids.size);

  if (duplicates.length) {
    console.log('\nDuplicate statementNumber details:');
    for (const d of duplicates) {
      console.log(`* ${d.statementNumber} -> count=${d.count} rows:`);
      for (const r of d.rows) console.log('  -', r);
    }
  }

  if (missingShopSids.size) {
    console.log('\nMissing shopSids:');
    for (const s of missingShopSids) console.log('-', s);
  }

  // Also list per-account breakdown
  const byAccount = new Map();
  for (const r of rows) {
    const acc = r.accountId;
    const prev = byAccount.get(acc) ?? { gross: 0, payout: 0, count: 0, statements: [] };
    prev.gross += Number(r.grossSales ?? 0);
    prev.payout += Number(r.payoutAmount ?? r.grossSales ?? 0);
    prev.count += 1;
    prev.statements.push(r.statementNumber);
    byAccount.set(acc, prev);
  }

  console.log('\nPer-account breakdown:');
  for (const [acc, vals] of byAccount.entries()) {
    console.log(`- accountId=${acc}: statements=${vals.count}, gross=${vals.gross.toFixed(2)}, payout=${vals.payout.toFixed(2)}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
