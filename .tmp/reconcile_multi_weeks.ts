import { prisma } from "../src/lib/prisma";
import recomputeWeeklySummary from "../src/lib/jobs/recomputeWeeklySummaries";

function startOfWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

async function main() {
  const weeks = Number(process.argv[2] || 8);
  const today = new Date();
  const results: any[] = [];
  for (let i = 0; i < weeks; i++) {
    const ref = new Date(today);
    ref.setUTCDate(ref.getUTCDate() - i * 7);
    const weekStart = startOfWeek(ref);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    const aggs = await recomputeWeeklySummary(weekStart, weekEnd);
    // also scan raw rows for duplicates/missing
    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: weekEnd } }, { weekEnd: { gte: weekStart } }] } });
    const byStatement = new Map<string, any[]>();
    const missingSids = new Set<string>();
    for (const r of rows) {
      const sn = r.statementNumber ?? '(none)';
      if (!byStatement.has(sn)) byStatement.set(sn, []);
      byStatement.get(sn)!.push(r);
      const sid = (r.rawPayload as any)?.shopSid ?? null;
      if (sid) {
        const acct = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: sid } });
        if (!acct) missingSids.add(sid);
      }
    }
    const duplicates = [];
    for (const [sn, arr] of byStatement.entries()) if (arr.length > 1) duplicates.push({ sn, count: arr.length });
    const weeklySale = await prisma.weeklySale.aggregate({ _sum: { amount: true }, where: { platform: 'JUMIA', weekStart, weekEnd } });
    const weeklySum = weeklySale._sum.amount ?? 0;
    const totalGross = aggs.reduce((s, a) => s + Number(a.totalGross ?? 0), 0);
    results.push({ weekStart: weekStart.toISOString().split('T')[0], weekEnd: weekEnd.toISOString().split('T')[0], groups: aggs.length, totalGross, weeklySum, duplicates: duplicates.length, missingSids: missingSids.size });
  }
  console.log('Reconciliation report (most recent first):');
  for (const r of results) {
    console.log(`- ${r.weekStart} -> ${r.weekEnd}: payoutGroups=${r.groups}, gross=${r.totalGross.toFixed(2)}, weeklySum=${Number(r.weeklySum).toFixed(2)}, duplicates=${r.duplicates}, missingSids=${r.missingSids}`);
  }
  await prisma.$disconnect();
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
