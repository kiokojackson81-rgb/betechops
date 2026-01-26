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
    const user = await prisma.user.findUnique({ where: { email: 'jeniffer@betech.co.ke' }, select: { id: true, email: true } });
    if (!user) return console.error('User not found: jeniffer@betech.co.ke');

    const period = getPreviousTradingPeriod();
    const start = period.start;
    const end = period.end;

    // Try to find a persisted ledger first
    const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: start, periodEnd: end } } });

    // Sum profit snapshots as fallback for sales/profit
    const snapshots = await prisma.profitSnapshot.findMany({
      where: {
        orderItem: {
          order: {
            attendantId: user.id,
            createdAt: { gte: start, lte: end },
          },
        },
      },
      select: { revenue: true, profit: true },
    });

    let totalSales = 0;
    let totalProfit = 0;
    for (const s of snapshots) {
      totalSales += Number(s.revenue ?? 0);
      totalProfit += Number(s.profit ?? 0);
    }

    console.log('Period:', start.toISOString(), '-', end.toISOString());
    console.log(JSON.stringify({ totalSales, totalProfit, ledger: ledger ? { commissionTotal: ledger.commissionTotal, grossCommission: ledger.grossCommission, netCommission: ledger.netCommission } : null }, null, 2));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
