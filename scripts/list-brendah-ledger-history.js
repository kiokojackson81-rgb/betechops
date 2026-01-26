const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getTradingPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year;
    startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear();
    endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear();
    startMonth = prev.getMonth();
    endYear = year;
    endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
  return { start, end };
}

function getPreviousTradingPeriod() {
  const current = getTradingPeriodFor(new Date());
  const prevEnd = new Date(current.start.getTime() - 24 * 60 * 60 * 1000);
  return getTradingPeriodFor(prevEnd);
}

(async () => {
  try {
    const email = 'brendah@betech.co.ke';
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) return console.error('User not found:', email);

    const period = getPreviousTradingPeriod();
    const start = period.start;
    const end = period.end;

    // list nearby ledger rows within +/- 2 days of period.start
    const from = new Date(start.getTime() - 2 * 24 * 60 * 60 * 1000);
    const to = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);

    const rows = await prisma.commissionLedger.findMany({
      where: {
        userId: user.id,
        periodStart: { gte: from, lte: to },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log('period:', start.toISOString(), '-', end.toISOString());
    console.log('found ledger rows:', rows.length);
    for (const r of rows) {
      console.log({ id: r.id, createdAt: r.createdAt, commissionTotal: r.commissionTotal, grossCommission: r.grossCommission, netCommission: r.netCommission });
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
