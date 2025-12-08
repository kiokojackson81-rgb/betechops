(async () => {
  try {
    const impersonateId = process.argv[2] || 'cmimxqfnr0005v5mc05nwhg9o';
    const dateStr = process.argv[3] || null;
    console.log(`Fetching marketing summary for impersonateId=${impersonateId} date=${dateStr}`);

    const { prisma } = require('../src/lib/prisma');
    const { getCurrentTradingPeriod, getTradingPeriodFor } = require('../src/lib/tradingPeriod');
    const { summarizeMarketingReportsForPeriod } = require('../src/lib/marketingPeriodTotals');
    const { getSupportPeriodAggregates } = require('../src/lib/supportEntries');
    const { getCommissionSummaryForSales } = require('../src/lib/marketingCommission');
    const { getUnpricedDailySalesForCurrentPeriod } = require('../src/lib/marketingUnpricedSales');

    const basisDate = dateStr ? new Date(dateStr) : null;
    const period = basisDate ? getTradingPeriodFor(basisDate) : await getCurrentTradingPeriod();
    const argPeriod = period;

    const [{ totals: marketingTotals }, supportSummary] = await Promise.all([
      summarizeMarketingReportsForPeriod({ userId: impersonateId, period: argPeriod, client: prisma }),
      getSupportPeriodAggregates({ userId: impersonateId, period: argPeriod, client: prisma }),
    ]);

    const supportTotals = supportSummary?.aggregates ?? { totalSales: 0, totalProfit: 0, totalReceipts: 0, totalItems: 0 };

    const totalSales = marketingTotals.totalSales + supportTotals.totalSales;
    const totalProfit = marketingTotals.totalProfit + supportTotals.totalProfit;
    const totalItems = marketingTotals.totalItems + supportTotals.totalItems;
    const totalReceipts = marketingTotals.totalReceipts + supportTotals.totalReceipts;

    const commissionInfo = getCommissionSummaryForSales(totalSales);
    let commission = commissionInfo.commission ?? 0;
    if (commission === 0 && totalSales > 0 && totalSales < 500_000) {
      commission = Math.round(Math.max(totalProfit, 0) * 0.05);
    }

    // zero commission if this user has unpriced sales this period
    try {
      const user = await prisma.user.findUnique({ where: { id: impersonateId }, select: { email: true } });
      const userEmail = user?.email?.toLowerCase() ?? null;
      if (userEmail) {
        const unpriced = await getUnpricedDailySalesForCurrentPeriod();
        const hasUnpricedForUser = unpriced.some((s) => (s.attendantEmail ?? '').toLowerCase() === userEmail);
        if (hasUnpricedForUser) {
          commission = 0;
        }
      }
    } catch (e) {
      // ignore
    }

    const normalizedPeriod = {
      key: String((period && period.key) || ''),
      label: String((period && period.label) || ''),
      start: (period && (period.start || period.startDate) && (period.start || period.startDate).toISOString()) || null,
      end: (period && (period.end || period.endDate) && (period.end || period.endDate).toISOString()) || null,
    };

    const out = {
      period: normalizedPeriod,
      aggregates: {
        totalSales,
        totalProfit,
        totalItems,
        totalReceipts,
        paymentStats: marketingTotals.paymentStats,
        commission: { commission },
      },
    };

    console.log(JSON.stringify(out, null, 2));
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e);
    try { const { prisma } = require('../src/lib/prisma'); if (prisma) await prisma.$disconnect(); } catch (_) {}
    process.exit(1);
  }
})();
