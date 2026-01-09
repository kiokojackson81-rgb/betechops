// scripts/get-betech-payouts.js
try { require('dotenv/config'); } catch {}
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main() {
  try {
    const search = 'betech';
    const accounts = await prisma.marketplaceAccount.findMany({
      where: { displayName: { contains: search, mode: 'insensitive' } },
      select: { id: true, displayName: true, jumiaShopSid: true },
    });

    if (!accounts.length) {
      console.log('[get-betech-payouts] no marketplace accounts matched "betech"');
      // fallback: try shops
      const shops = await prisma.shop.findMany({ where: { name: { contains: search, mode: 'insensitive' } }, select: { id: true, name: true, jumiaShopSid: true } });
      if (!shops.length) {
        console.log('[get-betech-payouts] no shops matched "betech" either.');
        process.exit(0);
      }
      // try map shops to accounts by jumiaShopSid
      const sids = shops.map((s) => s.jumiaShopSid).filter(Boolean);
      if (!sids.length) {
        console.log('[get-betech-payouts] matched shops but no jumiaShopSid to map.');
        console.table(shops);
        process.exit(0);
      }
      const acctBySid = await prisma.marketplaceAccount.findMany({ where: { jumiaShopSid: { in: sids } }, select: { id: true, displayName: true, jumiaShopSid: true } });
      if (!acctBySid.length) {
        console.log('[get-betech-payouts] no marketplace accounts mapped to matched shops.');
        process.exit(0);
      }
      accounts.push(...acctBySid);
    }

    console.log('[get-betech-payouts] matched accounts:', accounts.map(a => ({ id: a.id, displayName: a.displayName, jumiaShopSid: a.jumiaShopSid })));

    const accountIds = accounts.map((a) => a.id);
    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: { weekEnd: 'desc' },
      take: 6,
      select: { statementNumber: true, payoutAmount: true, grossSales: true, currency: true, weekStart: true, weekEnd: true, accountId: true },
    });

    if (!rows.length) {
      console.log('[get-betech-payouts] no MarketplacePayoutWeek rows found for matched accounts.');
      process.exit(0);
    }

    console.log('[get-betech-payouts] last', rows.length, 'payouts:');
    rows.forEach((r) => {
      const amt = Number(r.payoutAmount ?? r.grossSales ?? 0).toFixed(2);
      console.log(`- account=${r.accountId} statement=${r.statementNumber} weekEnd=${r.weekEnd.toISOString().slice(0,10)} payout=${amt} ${r.currency}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('[get-betech-payouts] failed', err);
    try { await prisma.$disconnect(); } catch {}
    process.exit(2);
  }
}

void main();
module.exports = {};
