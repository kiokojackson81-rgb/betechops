const { PrismaClient } = require('@prisma/client');

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

(async () => {
  const prisma = new PrismaClient();
  try {
    const email = process.argv[2] || process.env.USER_EMAIL;
    const dateArg = process.argv[3] || new Date().toISOString().slice(0, 10);
    if (!email) {
      console.error('Usage: node scripts/check-sales-for-user.js <email> <date>');
      process.exit(2);
    }
    console.log('Checking for', email, 'around date', dateArg);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('User not found:', email);
      process.exit(2);
    }
    const period = getTradingPeriodFor(new Date(dateArg));
    console.log('Trading period:', period.start.toISOString(), '->', period.end.toISOString());

    const weekly = await prisma.weeklySale.findMany({
      where: {
        userId: user.id,
        OR: [
          { weekStart: { gte: period.start, lte: period.end } },
          { weekEnd: { gte: period.start, lte: period.end } },
        ],
      },
      orderBy: [{ weekStart: 'asc' }],
    });

    const marketing = await prisma.marketingDailyEntry.findMany({
      where: { submittedById: user.id, date: { gte: period.start, lte: period.end } },
      orderBy: [{ date: 'asc' }],
    });

    console.log('WeeklySale rows found:', weekly.length);
    weekly.slice(0, 5).forEach((r) => console.log('  ', { id: r.id, weekStart: r.weekStart, weekEnd: r.weekEnd, amount: r.amount, status: r.status }));

    console.log('MarketingDailyEntry rows found:', marketing.length);
    marketing.slice(0, 5).forEach((r) => console.log('  ', { id: r.id, date: r.date, totalSales: r.totalSales, totalProfit: r.totalProfit }));

    // Also check commission ledger entries for that period
    const ledgers = await prisma.commissionLedger.findMany({ where: { userId: user.id, periodStart: { gte: period.start, lte: period.end } }, orderBy: [{ periodStart: 'desc' }] });
    console.log('CommissionLedger rows in period:', ledgers.length);
    ledgers.slice(0, 5).forEach((l) => console.log('  ', { id: l.id, grossCommission: l.grossCommission, netCommission: l.netCommission, detail: l.detail && l.detail.marketing ? l.detail.marketing.commission : undefined }));

  } catch (e) {
    console.error('Error checking sales:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
