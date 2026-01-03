// scripts/list-receipts-for-brendah.js
// Usage: DATABASE_URL="..." node scripts/list-receipts-for-brendah.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const USER_ID = 'cmimxqfnr0005v5mc05nwhg9o';
const USER_EMAIL = 'brendah@betech.co.ke';

(async () => {
  try {
    const entries = await prisma.marketingDailyEntry.findMany({
      where: { OR: [{ submittedById: USER_ID }, { submittedByEmail: USER_EMAIL }] },
      orderBy: { date: 'desc' },
      select: { id: true, date: true, submittedById: true, submittedByEmail: true },
    });
    if (!entries.length) {
      console.log('No marketing daily entries found for user');
      return;
    }
    console.log('Found', entries.length, 'daily entries');
    const entryIds = entries.map(e => e.id);

    const receipts = await prisma.marketingReceipt.findMany({
      where: { dailyEntryId: { in: entryIds } },
      include: { items: true, dailyEntry: { select: { id: true, date: true } } },
      orderBy: { createdAt: 'desc' },
    });

    console.log('Found', receipts.length, 'marketing receipts linked to those entries');

    let totalSelling = 0;
    let totalBuying = 0;
    let totalProfit = 0;

    receipts.forEach(r => {
      const selling = Number(r.sellingTotal) || 0;
      totalSelling += selling;
      const buying = r.buyingTotal && Number(r.buyingTotal) > 0 ? Number(r.buyingTotal) : (r.items || []).reduce((s, it) => s + (Number(it.buyingPrice) || 0), 0);
      if (buying > 0) totalBuying += buying;
      const profit = buying > 0 ? selling - buying : 0;
      totalProfit += profit;
    });

    console.log('\nTotals:');
    console.log('Total receipts:', receipts.length);
    console.log('Total selling:', totalSelling.toFixed(2));
    console.log('Total buying (where available):', totalBuying.toFixed(2));
    console.log('Total profit (where computable):', totalProfit.toFixed(2));

    console.log('\nSample receipts (first 200):');
    receipts.slice(0,200).forEach(r => {
      const selling = Number(r.sellingTotal) || 0;
      const buying = r.buyingTotal && Number(r.buyingTotal) > 0 ? Number(r.buyingTotal) : (r.items || []).reduce((s, it) => s + (Number(it.buyingPrice) || 0), 0);
      const profit = buying > 0 ? selling - buying : 0;
      console.log(r.id, r.receiptNumber || '', 'date=' + (r.dailyEntry?.date?.toISOString?.() ?? ''), 'selling=' + selling.toFixed(2), 'buying=' + buying.toFixed(2), 'profit=' + profit.toFixed(2), 'items=' + (r.items?.length || 0));
    });

  } catch (e) {
    console.error('Failed:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
})();
