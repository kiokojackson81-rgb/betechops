const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { recomputeMarketingCommissionLedger } = require('../src/lib/marketingPeriodTotals');
const { getTradingPeriodFor } = require('../src/lib/tradingPeriod');

(async () => {
  try {
    const period = getTradingPeriodFor(new Date('2025-12-25'));
    console.log('Using period', period.start.toISOString(), period.end.toISOString(), period.label);
    await recomputeMarketingCommissionLedger({ userId: 'cmimxqf9t0003v5mcjdq8x61p', period, client: prisma });
    console.log('Completed Jeniffer marketing ledger rebuild for', period.label);
  } catch (e) {
    console.error('Recompute failed:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
