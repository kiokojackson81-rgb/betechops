const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const email = process.argv[2] || 'brendah@betech.co.ke';
    const user = await p.user.findUnique({ where: { email } });
    if (!user) { console.log('user not found'); process.exit(2); }
    console.log('User:', user.email, user.id);

    // Support receipts
    const support = await p.supportReceipt.findMany({ where: { dailyEntry: { submittedById: user.id } }, include: { items: true } });
    console.log('\nSupport receipts (count=' + support.length + '):');
    for (const r of support) {
      const sumBuying = (r.items || []).reduce((s, it) => s + (it.buyingPrice || 0), 0);
      const profit = (r.sellingTotal || 0) - sumBuying;
      console.log({ id: r.id, receiptNumber: r.receiptNumber, sellingTotal: r.sellingTotal, sumBuying, profit, items: r.items.map(i=>({product:i.productName,buyingPrice:i.buyingPrice})) });
    }

    // Marketing receipts and sales
    const mReceipts = await p.marketingReceipt.findMany({ where: { dailyEntry: { submittedById: user.id } }, include: { items: true } });
    console.log('\nMarketing receipts (count=' + mReceipts.length + '):');
    for (const r of mReceipts) {
      const sumBuying = (r.items || []).reduce((s, it) => s + (it.buyingPrice || 0), 0);
      const profit = (r.sellingTotal || 0) - sumBuying;
      console.log({ id: r.id, receiptNumber: r.receiptNumber, sellingTotal: r.sellingTotal, sumBuying, profit, items: r.items.map(i=>({product:i.productName,buyingPrice:i.buyingPrice})) });
    }

    // Marketing sales grouped by receiptNumber (in case many dailySales were converted)
    const mSales = await p.marketingSale.findMany({ where: { entry: { submittedById: user.id } } });
    console.log('\nMarketing sales (count=' + mSales.length + '):');
    const byReceipt = {};
    mSales.forEach(s => {
      const key = s.receiptNumber || 'NO_RECEIPT_' + s.dailySaleId;
      if (!byReceipt[key]) byReceipt[key] = { receipt: key, items: [], totalBuying:0, totalSelling:0 };
      byReceipt[key].items.push({ product: s.product, buyingPrice: s.buyingPrice, sellingPrice: s.sellingPrice });
      byReceipt[key].totalBuying += s.buyingPrice || 0;
      byReceipt[key].totalSelling += s.sellingPrice || 0;
    });
    for (const k of Object.keys(byReceipt)) {
      const r = byReceipt[k];
      r.profit = r.totalSelling - r.totalBuying;
      console.log(r);
    }

    process.exit(0);
  } catch (e) {
    console.error('failed', e);
    process.exit(1);
  } finally {
    try { await p.$disconnect(); } catch (_) {}
  }
})();
