import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';
import { getTradingPeriodFor } from '../src/lib/tradingPeriod.ts';

async function main() {
  const userId = process.argv[2] || 'cmimxqfnr0005v5mc05nwhg9o';
  const periodArgStart = process.argv[3];
  const periodArgEnd = process.argv[4];
  const period = periodArgStart && periodArgEnd
    ? { start: new Date(periodArgStart + 'T00:00:00.000Z'), end: new Date(periodArgEnd + 'T23:59:59.999Z') }
    : getTradingPeriodFor(new Date());

  console.log('Zeroing dailyReport.commissionEarned for user:', userId);
  console.log('Period:', period.start.toISOString(), '->', period.end.toISOString());

  const reports = await prisma.dailyReport.findMany({
    where: { userId, date: { gte: period.start, lte: period.end } },
    select: { id: true, tasks: true, commissionEarned: true },
  });

  console.log('Found', reports.length, 'dailyReport rows');

  let updated = 0;
  for (const r of reports) {
    const tasks = (r.tasks as any) ?? {};
    const metrics = (tasks.metrics as any) ?? {};
    if (metrics.commissionEarned === 0 && Number(r.commissionEarned ?? 0) === 0) continue;

    const newMetrics = { ...metrics, commissionEarned: 0 };
    const newTasks = { ...tasks, metrics: newMetrics };

    await prisma.dailyReport.update({ where: { id: r.id }, data: { commissionEarned: 0, tasks: newTasks } });
    updated += 1;
  }

  console.log('Updated rows:', updated);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
