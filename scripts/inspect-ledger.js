const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const userId = process.argv[2];
    if (!userId) {
      const rows = await prisma.commissionLedger.findMany({ orderBy: [{ periodStart: 'desc' }, { userId: 'asc' }], take: 50 });
      console.log('commissionLedger rows (latest 50):');
      rows.forEach((r) => {
        console.log({ id: r.id, userId: r.userId, periodStart: r.periodStart, periodEnd: r.periodEnd, commissionTotal: r.commissionTotal, grossCommission: r.grossCommission, netCommission: r.netCommission });
      });
      await prisma.$disconnect();
      return;
    }

    // compute current trading period
    function getTradingPeriodFor(date) {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();

      let startYear, startMonth, endYear, endMonth;
      if (day >= 25) {
        startYear = year; startMonth = month;
        const next = new Date(year, month+1, 1);
        endYear = next.getFullYear(); endMonth = next.getMonth();
      } else {
        const prev = new Date(year, month-1, 1);
        startYear = prev.getFullYear(); startMonth = prev.getMonth();
        endYear = year; endMonth = month;
      }
      const start = new Date(startYear, startMonth, 25, 0,0,0,0);
      const end = new Date(endYear, endMonth, 24, 23,59,59,999);
      return { start, end };
    }

    const now = new Date();
    console.log('Searching ledger for user', userId, 'containing now', now.toISOString());
    const ledger = await prisma.commissionLedger.findFirst({ where: { userId, periodStart: { lte: now }, periodEnd: { gte: now } } });
    if (!ledger) {
      console.log('No ledger found for user containing current time');
      // Also list recent ledgers for that user
      const recent = await prisma.commissionLedger.findMany({ where: { userId }, orderBy: [{ periodStart: 'desc' }], take: 10 });
      console.log('Recent ledgers for user:', recent.map(r => ({ id: r.id, periodStart: r.periodStart, periodEnd: r.periodEnd, commissionTotal: r.commissionTotal })));
      await prisma.$disconnect();
      return;
    }
    console.log('ledger:', { id: ledger.id, userId: ledger.userId, periodStart: ledger.periodStart, periodEnd: ledger.periodEnd, commissionTotal: ledger.commissionTotal, grossCommission: ledger.grossCommission, netCommission: ledger.netCommission });
    console.log('detail:', JSON.stringify(ledger.detail, null, 2));
  } catch (e) {
    console.error('inspect failed:', e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
