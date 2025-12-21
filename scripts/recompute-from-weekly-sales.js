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
  const key = `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
  return { start, end, key };
}

const COMMISSION_LADDER = [
  { min: 1000000, reward: 10000 },
  { min: 2000000, reward: 15000 },
  { min: 3000000, reward: 20000 },
  { min: 4000000, reward: 20000 },
  { min: 5000000, reward: 20000 },
  { min: 6000000, reward: 20000 },
  { min: 7000000, reward: 20000 },
  { min: 8000000, reward: 20000 },
  { min: 9000000, reward: 20000 },
  { min: 10000000, reward: 20000 },
];

function calculateCumulativeCommission(totalSales) {
  const tiersReached = COMMISSION_LADDER.filter((t) => t.min <= totalSales);
  const commission = tiersReached.reduce((s, t) => s + t.reward, 0);
  const nextTier = COMMISSION_LADDER.find((t) => t.min > totalSales) || null;
  return { commission, tiersReached: tiersReached.map((t) => `${t.min}`), nextTarget: nextTier ? nextTier.min : null, nextTierReward: nextTier ? nextTier.reward : null };
}

(function () {
  const prisma = new PrismaClient();
  (async () => {
    try {
      const email = process.argv[2] || process.env.USER_EMAIL;
      const dateArg = process.argv[3] || new Date().toISOString().slice(0, 10);
      if (!email) {
        console.error('Usage: node scripts/recompute-from-weekly-sales.js <email> <date>');
        process.exit(2);
      }
      console.log('Recomputing commission from WeeklySale for', email, 'around', dateArg);
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.error('User not found:', email);
        process.exit(2);
      }
      const period = getTradingPeriodFor(new Date(dateArg));
      console.log('Period:', period.start.toISOString(), '->', period.end.toISOString());

      const rows = await prisma.weeklySale.findMany({
        where: {
          userId: user.id,
          status: 'APPROVED',
          weekStart: { gte: period.start, lte: period.end },
        },
      });

      const total = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
      console.log('Approved WeeklySale total for period:', total);

      const commissionInfo = calculateCumulativeCommission(total);
      const marketingCommission = commissionInfo.commission || 0;
      console.log('Calculated commission from weeklySales:', marketingCommission);

      if (marketingCommission === 0 && total === 0) {
        console.log('Nothing to update (zero sales).');
        process.exit(0);
      }

      const existingLedger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } } });
      const previousMarketingCommission = existingLedger && existingLedger.detail && existingLedger.detail.marketing ? Number(existingLedger.detail.marketing.commission || 0) : 0;
      const grossBeforeMarketing = Math.max(0, Number(existingLedger ? existingLedger.grossCommission : 0) - previousMarketingCommission);
      const grossCommission = grossBeforeMarketing + marketingCommission;
      const penalties = Number(existingLedger ? existingLedger.penalties || 0 : 0);
      const netCommission = grossCommission - penalties;

      const nextDetail = Object.assign({}, existingLedger && existingLedger.detail ? existingLedger.detail : {}, { marketing: { periodKey: period.key, totals: { totalSales: total }, commission: marketingCommission, computedAt: new Date().toISOString() } });

      const ledger = await prisma.commissionLedger.upsert({
        where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } },
        update: { grossCommission: grossCommission.toFixed(2), netCommission: netCommission.toFixed(2), detail: nextDetail, commissionTotal: (Number(existingLedger?.commissionTotal ?? 0) - previousMarketingCommission + marketingCommission).toFixed(2) },
        create: { userId: user.id, periodStart: period.start, periodEnd: period.end, grossCommission: grossCommission.toFixed(2), netCommission: netCommission.toFixed(2), commissionTotal: marketingCommission.toFixed(2), detail: nextDetail },
      });

      console.log('Upserted ledger id=', ledger.id, 'commission=', marketingCommission);
    } catch (e) {
      console.error('Error:', e);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  })();
})();
