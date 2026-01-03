// scripts/sum-unpriced-marketing.js
// Usage:
// DATABASE_URL="..." node scripts/sum-unpriced-marketing.js brendah@betech.co.ke --from=2025-11-23 --to=2025-12-24

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const argv = require('minimist')(process.argv.slice(2));

const emailOrId = argv._[0] || 'brendah@betech.co.ke';
const fromArg = argv.from || argv.start || '2025-11-23';
const toArg = argv.to || argv.end || '2025-12-24';

(async () => {
  try {
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

    const receipts = await prisma.marketingReceipt.findMany({
      where: { dailyEntry: { submittedById: userId, date: { gte: from, lte: to } } },
      include: { items: true, dailyEntry: { select: { id: true, date: true } } },
    });

    let unpricedCount = 0;
    let unpricedSellingTotal = 0;
    const unpricedList = [];

    receipts.forEach(r => {
      const selling = Number(r.sellingTotal) || 0;
      const hasBuyingTotal = r.buyingTotal && Number(r.buyingTotal) > 0;
      const items = r.items || [];
      const itemsHavePrices = items.length > 0 && items.every(it => Number(it.buyingPrice) > 0);
      const priced = hasBuyingTotal || itemsHavePrices;
      if (!priced) {
        unpricedCount += 1;
        unpricedSellingTotal += selling;
        unpricedList.push({ id: r.id, receiptNumber: r.receiptNumber || '', date: r.dailyEntry?.date?.toISOString?.(), selling });
      }
    });

    console.log('\nUnpriced marketing receipts:');
    console.log('Count:', unpricedCount);
    console.log('Total selling (amount):', unpricedSellingTotal.toFixed(2));
    if (unpricedList.length) {
      console.log('\nSample unpriced receipts (first 50):');
      unpricedList.slice(0,50).forEach(r => console.log(r.id, r.receiptNumber, 'date=' + (r.date || ''), 'selling=' + r.selling.toFixed(2)));
    }

  } catch (e) {
    console.error('Failed:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
})();
