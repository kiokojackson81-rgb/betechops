import { prisma } from "../src/lib/prisma";
import recomputeWeeklySummary from "../src/lib/jobs/recomputeWeeklySummaries";

async function main() {
  const arg = process.argv[2] || '2025-12-28';
  const [y, m, d] = arg.split('-').map((s) => Number(s));
  const weekStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  console.log('Reconciling week:', weekStart.toISOString().split('T')[0], '->', weekEnd.toISOString().split('T')[0]);

  const aggs = await recomputeWeeklySummary(weekStart, weekEnd);
  console.log('Aggregated payout groups found:', aggs.length);

  let totalGross = 0;
  let totalPayout = 0;
  const byStatement = new Map<string, any[]>();
  const missingShopSids = new Set<string>();

  // still fetch raw rows to detect duplicate statementNumbers and missing shopSids
  const rawRows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: weekEnd } }, { weekEnd: { gte: weekStart } }] } });
  for (const r of rawRows) {
    const sn = r.statementNumber ?? '(none)';
    if (!byStatement.has(sn)) byStatement.set(sn, []);
    byStatement.get(sn)!.push(r);
    const sid = (r.rawPayload as any)?.shopSid ?? null;
    if (sid) {
      const acct = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: sid } });
      if (!acct) missingShopSids.add(sid);
    }
  }

  for (const a of aggs) {
    totalGross += Number(a.totalGross ?? 0);
    totalPayout += Number(a.totalPayout ?? a.totalGross ?? 0);
  }

  const duplicates: any[] = [];
  for (const [sn, arr] of byStatement.entries()) if (arr.length > 1) duplicates.push({ statementNumber: sn, count: arr.length, rows: arr.map((x) => ({ id: x.id, accountId: x.accountId, grossSales: Number(x.grossSales ?? 0) })) });

  const weeklySale = await prisma.weeklySale.aggregate({ _sum: { amount: true }, where: { platform: 'JUMIA', weekStart, weekEnd } });
  const weeklySum = weeklySale._sum.amount ?? 0;

  console.log('\nSummary');
  console.log('- Total grossSales (aggregated MarketplacePayoutWeek):', totalGross.toFixed(2));
  console.log('- Total payoutAmount (aggregated MarketplacePayoutWeek):', totalPayout.toFixed(2));
  console.log('- WeeklySale total (platform=JUMIA):', Number(weeklySum).toFixed(2));
  console.log('- Statement raw rows scanned:', rawRows.length);
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

  // Per-account breakdown using aggregated groups
  const byAccount = new Map<string, { gross: number; payout: number; count: number; statements: string[] }>();
  for (const a of aggs) {
    const prev = byAccount.get(a.accountId) ?? { gross: 0, payout: 0, count: 0, statements: [] };
    prev.gross += Number(a.totalGross ?? 0);
    prev.payout += Number(a.totalPayout ?? 0);
    prev.count += 1;
    prev.statements.push('agg');
    byAccount.set(a.accountId, prev);
  }

  console.log('\nPer-account breakdown:');
  for (const [acc, vals] of byAccount.entries()) {
    console.log(`- accountId=${acc}: statements=${vals.count}, gross=${vals.gross.toFixed(2)}, payout=${vals.payout.toFixed(2)}`);
  }

  await prisma.$disconnect();
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
