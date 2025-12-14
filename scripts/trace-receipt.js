const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const key = process.argv[2] || 'Receipt Betech-20251210-19935';
    console.log('Searching for receipt:', key);

    const mRec = await p.marketingReceipt.findFirst({ where: { receiptNumber: key }, include: { items: true, dailyEntry: { include: { submittedBy: true } } } });
    console.log('\nmarketingReceipt:', mRec ? { id: mRec.id, receiptNumber: mRec.receiptNumber, sellingTotal: mRec.sellingTotal, paymentMethod: mRec.paymentMethod, createdAt: mRec.createdAt, items: mRec.items.map(i=>({id:i.id, productName:i.productName, buyingPrice:i.buyingPrice})) , dailyEntrySubmittedBy: mRec.dailyEntry ? mRec.dailyEntry.submittedBy?.email : null } : null);

    const sRec = await p.supportReceipt.findFirst({ where: { receiptNumber: key }, include: { items: true, dailyEntry: { include: { submittedBy: true } } } });
    console.log('\nsupportReceipt:', sRec ? { id: sRec.id, receiptNumber: sRec.receiptNumber, sellingTotal: sRec.sellingTotal, paymentMethod: sRec.paymentMethod, items: sRec.items.map(i=>({id:i.id, productName:i.productName, buyingPrice:i.buyingPrice})), dailyEntrySubmittedBy: sRec.dailyEntry ? sRec.dailyEntry.submittedBy?.email : null } : null);

    const dSales = await p.dailySale.findMany({ where: { receiptNumber: key }, include: { dailyReport: { include: { user: true } }, marketingSales: true } });
    console.log('\ndailySales (count=' + dSales.length + '):');
    dSales.forEach(s => console.log({ id: s.id, productName: s.productName, price: s.price, paymentMethod: s.paymentMethod, marketingSalesCount: (s.marketingSales||[]).length, dailyReportUser: s.dailyReport?.user?.email }));

    const mSales = await p.marketingSale.findMany({ where: { receiptNumber: key } });
    console.log('\nmarketingSales (count=' + mSales.length + '):');
    mSales.forEach(s => console.log({ id: s.id, dailySaleId: s.dailySaleId, product: s.product, buyingPrice: s.buyingPrice, sellingPrice: s.sellingPrice, createdAt: s.createdAt }));

    // If we found a user id via dailyEntry or dailyReport, fetch commission ledgers
    const userEmails = new Set();
    if (mRec && mRec.dailyEntry && mRec.dailyEntry.submittedBy) userEmails.add(mRec.dailyEntry.submittedBy.email);
    if (sRec && sRec.dailyEntry && sRec.dailyEntry.submittedBy) userEmails.add(sRec.dailyEntry.submittedBy.email);
    dSales.forEach(s => { if (s.dailyReport && s.dailyReport.user && s.dailyReport.user.email) userEmails.add(s.dailyReport.user.email); });

    for (const email of userEmails) {
      const user = await p.user.findUnique({ where: { email } });
      if (!user) continue;
      const ledgers = await p.commissionLedger.findMany({ where: { userId: user.id }, orderBy: { periodStart: 'desc' } });
      console.log(`\nCommission ledgers for ${email} (count=${ledgers.length}):`);
      ledgers.forEach(l => console.log({ id: l.id, periodStart: l.periodStart, periodEnd: l.periodEnd, gross: l.grossCommission, net: l.netCommission, detailMarketing: l.detail?.marketing ? { commission: l.detail.marketing.commission, totals: l.detail.marketing.totals } : null }));
    }

    if (userEmails.size === 0) console.log('\nNo attendant mapping found for this receipt in dailyEntry/dailyReport.');

    process.exit(0);
  } catch (e) {
    console.error('Search failed:', e);
    process.exit(1);
  } finally {
    try { await p.$disconnect(); } catch (_) {}
  }
})();
