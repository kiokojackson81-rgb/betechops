const { PrismaClient } = require('@prisma/client');

function getTradingPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year; startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear(); endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear(); startMonth = prev.getMonth();
    endYear = year; endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
  return { start, end };
}

async function main() {
  const email = process.argv[2] || 'brendah@betech.co.ke';
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      console.error('User not found:', email);
      process.exit(2);
    }
    const period = getTradingPeriodFor(new Date());
    console.log('Checking receipts for', email, 'period', period.start.toISOString(), '-', period.end.toISOString());

    const marketingAgg = await prisma.marketingReceipt.aggregate({
      where: { dailyEntry: { submittedById: user.id, date: { gte: period.start, lte: period.end } } },
      _sum: { sellingTotal: true, buyingTotal: true },
      _count: { id: true },
    });

    const supportAgg = await prisma.supportReceipt.aggregate({
      where: { dailyEntry: { submittedById: user.id, date: { gte: period.start, lte: period.end } } },
      _sum: { sellingTotal: true, buyingTotal: true },
      _count: { id: true },
    });

    console.log('Marketing receipts: count=', marketingAgg._count.id, 'sumSelling=', Number(marketingAgg._sum.sellingTotal || 0), 'sumBuying=', Number(marketingAgg._sum.buyingTotal || 0));
    console.log('Support receipts:   count=', supportAgg._count.id, 'sumSelling=', Number(supportAgg._sum.sellingTotal || 0), 'sumBuying=', Number(supportAgg._sum.buyingTotal || 0));

    const sampleMarketing = await prisma.marketingReceipt.findMany({ where: { dailyEntry: { submittedById: user.id, date: { gte: period.start, lte: period.end } } }, take: 10, include: { items: true, dailyEntry: true } });
    const sampleSupport = await prisma.supportReceipt.findMany({ where: { dailyEntry: { submittedById: user.id, date: { gte: period.start, lte: period.end } } }, take: 10, include: { items: true, dailyEntry: true } });

    console.log('\nSample Marketing Receipts:');
    sampleMarketing.forEach(r => {
      console.log(r.id, 'selling=', r.sellingTotal, 'buying=', r.buyingTotal, 'items=', (r.items||[]).length);
    });

    console.log('\nSample Support Receipts:');
    sampleSupport.forEach(r => {
      console.log(r.id, 'selling=', r.sellingTotal, 'buying=', r.buyingTotal, 'items=', (r.items||[]).length);
    });

  } catch (e) {
    console.error('Failed:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
