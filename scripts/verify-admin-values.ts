import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';
import { getTradingPeriodFor } from '../src/lib/tradingPeriod.ts';

async function main() {
  const userId = process.argv[2] || 'cmimxqfnr0005v5mc05nwhg9o';
  const period = getTradingPeriodFor(new Date());

  console.log('Verifying admin UI values for', userId, 'period', period.label);

  // 1) dailyReport aggregate sum of commissionEarned (server summary)
  const agg = await prisma.dailyReport.aggregate({
    where: { userId, date: { gte: period.start, lte: period.end } },
    _sum: { commissionEarned: true },
  });
  const summaryTotalCommission = agg._sum.commissionEarned ? Number(agg._sum.commissionEarned) : 0;

  // 2) fallback: sum of tasks.metrics.commissionEarned across reports (client-side sum)
  const reports = await prisma.dailyReport.findMany({ where: { userId, date: { gte: period.start, lte: period.end } }, select: { tasks: true } });
  let metricsSum = 0;
  for (const r of reports) {
    try {
      const tasks = (r.tasks as any) ?? {};
      const metrics = tasks.metrics ?? {};
      const c = Number(metrics.commissionEarned ?? 0);
      metricsSum += Number.isFinite(c) ? c : 0;
    } catch (_) {}
  }

  const preLedgerValue = summaryTotalCommission || metricsSum;

  // 3) fetch ledger row and compute ledger override value according to client logic
  const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId, periodStart: period.start, periodEnd: period.end } } });
  let ledgerOverride = 0;
  if (ledger) {
    const marketingCommission = Number((ledger as any).detail?.marketing?.commission ?? 0);
    const supportCommission = Number((ledger as any).detail?.support?.commission ?? 0);
    const s = Number(ledger.netCommission ?? ledger.grossCommission ?? 0);
    ledgerOverride = (marketingCommission + supportCommission) || s || 0;
  }

  console.log('summaryTotalCommission (DB aggregate):', summaryTotalCommission);
  console.log('metricsSum (tasks.metrics):', metricsSum);
  console.log('value admin UI would use BEFORE ledger override:', preLedgerValue);
  if (ledger) {
    console.log('commissionLedger row found:', ledger.id);
    console.log('ledger detail marketing commission:', (ledger as any).detail?.marketing?.commission ?? 0);
    console.log('ledger detail support commission:', (ledger as any).detail?.support?.commission ?? 0);
    console.log('ledger grossCommission:', ledger.grossCommission, 'netCommission:', ledger.netCommission, 'commissionTotal:', ledger.commissionTotal);
    console.log('value ADMIN UI will display (ledger override):', ledgerOverride);
  } else {
    console.log('No commissionLedger row exists for this period; admin UI will display pre-ledger value.');
  }

  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
