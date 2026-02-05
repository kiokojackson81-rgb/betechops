const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function startOfWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

async function main() {
  const weeks = Number(process.argv[2] || 8);
  const today = new Date();
  const results = [];
  for (let i = 0; i < weeks; i++) {
    const ref = new Date(today);
    ref.setUTCDate(ref.getUTCDate() - i * 7);
    const weekStart = startOfWeek(ref);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    // find raw payout rows that overlap this week window, then aggregate per-account/week
    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: weekEnd } }, { weekEnd: { gte: weekStart } }] } });
    const aggMap = new Map();
    const byStatement = new Map();
    const missingSids = new Set();
    for (const r of rows) {
      const wkStartIso = new Date(r.weekStart).toISOString();
      const wkEndIso = new Date(r.weekEnd).toISOString();
      const key = `${r.accountId}::${wkStartIso}::${wkEndIso}`;
      aggMap.set(key, (aggMap.get(key) || 0) + Number(r.payoutAmount ?? r.grossSales ?? 0));
      const sn = r.statementNumber ?? '(none)';
      if (!byStatement.has(sn)) byStatement.set(sn, []);
      byStatement.get(sn).push(r);
      const sid = r.rawPayload?.shopSid ?? null;
      if (sid) {
        const acct = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: sid } });
        if (!acct) missingSids.add(sid);
      }
    }
    const duplicates = [];
    for (const [sn, arr] of byStatement.entries()) if (arr.length > 1) duplicates.push({ sn, count: arr.length });
    const weeklySale = await prisma.weeklySale.aggregate({ _sum: { amount: true }, where: { platform: 'JUMIA', weekStart, weekEnd } });
    const weeklySum = weeklySale._sum.amount ?? 0;
    const totalGross = Array.from(aggMap.values()).reduce((s, v) => s + v, 0);
    results.push({ weekStart: weekStart.toISOString().split('T')[0], weekEnd: weekEnd.toISOString().split('T')[0], rows: aggMap.size, totalGross, totalPayout: totalGross, weeklySum, duplicates: duplicates.length, missingSids: missingSids.size });
  }
  console.log('Reconciliation report (most recent first):');
  for (const r of results) {
    console.log(`- ${r.weekStart} -> ${r.weekEnd}: payoutRows=${r.rows}, gross=${r.totalGross.toFixed(2)}, weeklySum=${Number(r.weeklySum).toFixed(2)}, duplicates=${r.duplicates}, missingSids=${r.missingSids}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
