// scripts/compare-payouts-betech-store.js
try { require('dotenv/config'); } catch {}
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main() {
  try {
    const accountId = process.argv.find(a => a.startsWith('--accountId='))?.split('=')[1] || '303a17e3-f7e0-40fd-9adc-aa0a6820f90d';
    const start = new Date('2025-12-01T00:00:00Z');
    const end = new Date('2026-01-11T23:59:59Z');

    console.log('[compare] accountId=', accountId, 'range=', start.toISOString(), '->', end.toISOString());

    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: {
        accountId,
        AND: [
          { weekStart: { gte: start } },
          { weekEnd: { lte: end } },
        ],
      },
      orderBy: { weekStart: 'desc' },
      select: { statementNumber: true, weekStart: true, weekEnd: true, payoutAmount: true, grossSales: true, currency: true, isPaid: true, rawPayload: true },
    });

    if (!rows.length) {
      console.log('[compare] no rows found');
      process.exit(0);
    }

    let sum = 0;
    console.log('[compare] rows:');
    for (const r of rows) {
      const amt = Number(r.payoutAmount ?? r.grossSales ?? 0);
      sum += amt;
      console.log(`- statement=${r.statementNumber} week=${r.weekStart.toISOString().slice(0,10)} -> ${r.weekEnd.toISOString().slice(0,10)} payout=${amt.toFixed(2)} ${r.currency} status=${r.isPaid ? 'PAID' : 'OPEN'}`);
    }

    console.log('[compare] total payout sum for range:', sum.toFixed(2));

    // Manual list provided by user totals
    const manual = [198706.71, 424086.62, 385230.73, 679703.48, 439094.46, 705687.35];
    const manualSum = manual.reduce((a,b)=>a+b,0);
    console.log('[compare] manual total sum:', manualSum.toFixed(2));

    console.log('[compare] difference (manual - db):', (manualSum - sum).toFixed(2));

    process.exit(0);
  } catch (err) {
    console.error('[compare] failed', err);
    try { await prisma.$disconnect(); } catch {}
    process.exit(2);
  }
}

void main();
module.exports = {};
