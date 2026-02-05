// scripts/payout-week-breakdown.js
try { require('dotenv/config'); } catch {}
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main() {
  try {
    const weekStartArg = process.argv.find(a => a.startsWith('--weekStart='))?.split('=')[1];
    const weekEndArg = process.argv.find(a => a.startsWith('--weekEnd='))?.split('=')[1];
    if (!weekStartArg && !weekEndArg) {
      console.error('Usage: node scripts/payout-week-breakdown.js --weekStart=YYYY-MM-DD | --weekEnd=YYYY-MM-DD');
      process.exit(2);
    }

    const where = {};
    if (weekStartArg) where.weekStart = new Date(weekStartArg + 'T00:00:00Z');
    if (weekEndArg) where.weekEnd = new Date(weekEndArg + 'T23:59:59Z');

    const rows = await prisma.marketplacePayoutWeek.findMany({
      where,
      orderBy: { payoutAmount: 'desc' },
      select: { accountId: true, statementNumber: true, payoutAmount: true, grossSales: true, currency: true, isPaid: true, weekStart: true, weekEnd: true, rawPayload: true },
    });

    if (!rows.length) {
      console.log('[payout-breakdown] no rows for week', weekStartArg || weekEndArg);
      process.exit(0);
    }

    console.log('[payout-breakdown] rows for week:', weekStartArg || weekEndArg);
    rows.forEach(r => {
      const amt = Number(r.payoutAmount ?? r.grossSales ?? 0).toFixed(2);
      console.log(`- account=${r.accountId} stmt=${r.statementNumber} payout=${amt} ${r.currency} paid=${r.isPaid}`);
    });

    // summary: count zeros vs non-zero
    const totalAccounts = rows.length;
    const nonZero = rows.filter(r => Number(r.payoutAmount ?? r.grossSales ?? 0) > 0).length;
    console.log(`[payout-breakdown] summary: totalAccounts=${totalAccounts} nonZero=${nonZero} zero=${totalAccounts - nonZero}`);

    process.exit(0);
  } catch (err) {
    console.error('[payout-breakdown] failed', err);
    try { await prisma.$disconnect(); } catch {}
    process.exit(2);
  }
}

void main();
module.exports = {};
