// scripts/get-payouts-account.js
try { require('dotenv/config'); } catch {}
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main() {
  try {
    const arg = process.argv.find((a) => a.startsWith('--accountId=')) || process.argv.find((a) => a.startsWith('--displayName='));
    if (!arg) {
      console.error('Usage: node scripts/get-payouts-account.js --accountId=<id> | --displayName=<name>');
      process.exit(2);
    }

    let accountId = null;
    if (arg.startsWith('--accountId=')) accountId = arg.split('=')[1];
    if (arg.startsWith('--displayName=')) {
      const name = arg.split('=')[1];
      const acct = await prisma.marketplaceAccount.findFirst({ where: { displayName: { equals: name, mode: 'insensitive' } }, select: { id: true, displayName: true } });
      if (!acct) {
        console.error('[get-payouts-account] no marketplace account matched displayName', name);
        process.exit(0);
      }
      accountId = acct.id;
    }

    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: { accountId },
      orderBy: { weekEnd: 'desc' },
      take: 6,
      select: { statementNumber: true, payoutAmount: true, grossSales: true, currency: true, weekStart: true, weekEnd: true },
    });

    if (!rows.length) {
      console.log('[get-payouts-account] no payout rows found for account', accountId);
      process.exit(0);
    }

    console.log('[get-payouts-account] last', rows.length, 'payouts for account', accountId);
    rows.forEach((r) => {
      const amt = Number(r.payoutAmount ?? r.grossSales ?? 0).toFixed(2);
      console.log(`- statement=${r.statementNumber} weekEnd=${r.weekEnd.toISOString().slice(0,10)} payout=${amt} ${r.currency}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('[get-payouts-account] failed', err);
    try { await prisma.$disconnect(); } catch {}
    process.exit(2);
  }
}

void main();
module.exports = {};
