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

    const key1 = `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
    const key2 = `${start.toISOString().split('T')[0]}:${end.toISOString().split('T')[0]}`;

    const adjustments = await prisma.attendantPayrollAdjustment.findMany({
      where: {
        attendantId: user.id,
        OR: [
          { periodKey: key1 },
          { periodKey: key2 },
          { createdAt: { gte: start, lte: end } },
        ],
      },
    });

    console.log('period:', start.toISOString(), '-', end.toISOString());
    console.log('periodKeys tried:', key1, key2);
    console.log('adjustments:', JSON.stringify(adjustments, null, 2));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
