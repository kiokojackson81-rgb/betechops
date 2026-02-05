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
  const email = process.argv[2] || 'brendah@betech.co.ke';
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true, name: true } });
    if (!user) return console.error('User not found:', email);

    const period = getPreviousTradingPeriod();
    const start = period.start;
    const end = period.end;

    // Look for a persisted commission ledger for the period
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

    const summary = {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      period: { start: start.toISOString(), end: end.toISOString() },
      totals: { totalSales, totalProfit },
      ledger: ledger ? {
        commissionTotal: ledger.commissionTotal,
        grossCommission: ledger.grossCommission,
        netCommission: ledger.netCommission,
        detail: ledger.detail,
      } : null,
    };

    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
