(async ()=>{
  try {
    require('ts-node/register');
    require('tsconfig-paths/register');
  } catch (e) {}

  const { prisma } = await import('../src/lib/prisma.ts');
  const { getEarningsSummaryForUser } = await import('../src/lib/earningsSummary.ts');
  const { getRecentTradingPeriods } = await import('../src/lib/tradingPeriod');

  try {
    const user = await prisma.user.findUnique({ where: { email: 'jeniffer@betech.co.ke' }, select: { id: true, email: true } });
    if (!user) return console.error('User not found: jeniffer@betech.co.ke');

    const periods = getRecentTradingPeriods(2);
    if (!periods || periods.length < 2) return console.error('Could not compute previous trading period');
    const prev = periods[1];

    const summary = await getEarningsSummaryForUser({ userId: user.id, asOf: prev.start });
    console.log('Period:', prev.label, prev.key);
    console.log(JSON.stringify({ totalSales: summary.totalSales, grossCommission: summary.grossCommission, salesCommission: summary.salesCommission }, null, 2));
  } catch (e) {
    console.error('Error fetching previous-period summary:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
