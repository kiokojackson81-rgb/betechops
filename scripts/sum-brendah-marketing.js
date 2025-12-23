// scripts/sum-brendah-marketing.js
// Usage:
// DATABASE_URL="..." node scripts/sum-brendah-marketing.js brendah@betech.co.ke --from=2025-11-23 --to=2025-12-24 --rate=0.1 --basis=profit
// Env: COMMISSION_RATE or --rate (decimal), --basis=profit|sales

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const argv = require('minimist')(process.argv.slice(2));

const emailOrId = argv._[0] || 'brendah@betech.co.ke';
const fromArg = argv.from || argv.start || '2025-11-23';
const toArg = argv.to || argv.end || '2025-12-24';
const rateArg = argv.rate || process.env.COMMISSION_RATE || argv.r || 0.1;
const basis = (argv.basis || process.env.COMMISSION_BASIS || 'profit').toLowerCase();
const rate = Number(rateArg) || 0.1;

(async () => {
  try {
    // find user
    let user = null;
    if (/^[0-9a-fA-F-]{10,}$/.test(emailOrId)) {
      user = await prisma.user.findUnique({ where: { id: emailOrId }, select: { id: true, email: true, name: true } });
    }
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: String(emailOrId).toLowerCase() }, select: { id: true, email: true, name: true } });
    }
    if (!user) {
      console.error('User not found for', emailOrId);
      process.exitCode = 2;
      return;
    }
    const userId = user.id;
    console.log('Found user:', userId, user.email, user.name || '');

    const from = new Date(fromArg + 'T00:00:00Z');
    const to = new Date(toArg + 'T23:59:59.999Z');
    console.log('Range:', from.toISOString(), '->', to.toISOString());
    console.log('Commission rate:', rate, 'basis:', basis);

    // find marketing receipts whose dailyEntry.submittedById = userId and dailyEntry.date within range
    const receipts = await prisma.marketingReceipt.findMany({
      where: { dailyEntry: { submittedById: userId, date: { gte: from, lte: to } } },
      include: { items: true, dailyEntry: { select: { id: true, date: true } } },
    });

    console.log('Found', receipts.length, 'marketing receipts');

    let totalSelling = 0;
    let totalProfit = 0;

    receipts.forEach(r => {
      const selling = Number(r.sellingTotal) || 0;
      totalSelling += selling;
      let profit = 0;
      if (r.buyingTotal && Number(r.buyingTotal) > 0) {
        profit = selling - Number(r.buyingTotal);
      } else if (r.items && r.items.length) {
        const buyingSum = r.items.reduce((s, it) => s + (Number(it.buyingPrice) || 0), 0);
        // Only include profit if we have item buying values
        if (buyingSum > 0) profit = selling - buyingSum;
      }
      totalProfit += profit;
    });

    const commissionByProfit = totalProfit * rate;
    const commissionBySales = totalSelling * rate;

    console.log('\nTotals:');
    console.log('Total selling (amount):', totalSelling.toFixed(2));
    console.log('Total profit:', totalProfit.toFixed(2));
    console.log('Commission (basis=profit):', commissionByProfit.toFixed(2));
    console.log('Commission (basis=sales):', commissionBySales.toFixed(2));

    const chosenCommission = basis === 'sales' ? commissionBySales : commissionByProfit;
    console.log('\nChosen commission (basis=' + basis + '):', chosenCommission.toFixed(2));

    // optionally output CSV of receipts
    console.log('\nSample receipts:');
    receipts.slice(0, 50).forEach(r => {
      const selling = Number(r.sellingTotal) || 0;
      let profit = 0;
      if (r.buyingTotal && Number(r.buyingTotal) > 0) profit = selling - Number(r.buyingTotal);
      else if (r.items && r.items.length) {
        const buyingSum = r.items.reduce((s, it) => s + (Number(it.buyingPrice) || 0), 0);
        if (buyingSum > 0) profit = selling - buyingSum;
      }
      console.log(r.id, r.receiptNumber || '', 'date=' + (r.dailyEntry?.date?.toISOString?.() ?? ''), 'selling=', selling.toFixed(2), 'profit=', profit.toFixed(2));
    });

  } catch (e) {
    console.error('Failed:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
})();
