const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

(async () => {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: node inspect-support.js <userId>');
    process.exit(2);
  }
  const period = getTradingPeriodFor(new Date());
  console.log('Period:', period.start.toISOString(), '-', period.end.toISOString());
  try {
    const rows = await prisma.supportDailyEntry.findMany({ where: { submittedById: userId, date: { gte: period.start, lte: period.end } }, include: { receipts: true, sales: true } });
    console.log('supportDailyEntry rows:', rows.length);
    rows.forEach((r,i) => {
      console.log(i, { id: r.id, date: r.date, totalSales: r.totalSales, totalProfit: r.totalProfit, receipts: (r.receipts||[]).length, sales: (r.sales||[]).length });
      if (r.sales && r.sales.length) console.log(' sales sample:', r.sales.slice(0,10));
      if (r.receipts && r.receipts.length) console.log(' receipts sample:', r.receipts.slice(0,10));
    });
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
