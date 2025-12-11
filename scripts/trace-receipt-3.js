const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const key = process.argv[2] || 'Betech-20251210-19935';
    console.log('Looking up exact and substring matches for:', key);

    const support = await p.supportReceipt.findFirst({ where: { receiptNumber: key }, include: { items: true, dailyEntry: { include: { submittedBy: true } } } });
    console.log('\nsupportReceipt (exact):', support ? { id: support.id, receiptNumber: support.receiptNumber, dailyEntryId: support.dailyEntryId, items: support.items.map(i=>({id:i.id,productName:i.productName,buyingPrice:i.buyingPrice})) } : null);

    const supportSub = await p.supportReceipt.findFirst({ where: { receiptNumber: { contains: key } }, include: { items: true } });
    console.log('\nsupportReceipt (contains):', supportSub ? { id: supportSub.id, receiptNumber: supportSub.receiptNumber } : null);

    const mRecExact = await p.marketingReceipt.findFirst({ where: { receiptNumber: key }, include: { items: true, dailyEntry: { include: { submittedBy: true } } } });
    console.log('\nmarketingReceipt (exact):', mRecExact ? { id: mRecExact.id, receiptNumber: mRecExact.receiptNumber, items: mRecExact.items.map(i=>({id:i.id,productName:i.productName,buyingPrice:i.buyingPrice})), dailyEntrySubmittedBy: mRecExact.dailyEntry?.submittedBy?.email } : null);

    const mRecSub = await p.marketingReceipt.findFirst({ where: { receiptNumber: { contains: key } }, include: { items: true } });
    console.log('\nmarketingReceipt (contains):', mRecSub ? { id: mRecSub.id, receiptNumber: mRecSub.receiptNumber } : null);

    const mSaleExact = await p.marketingSale.findFirst({ where: { receiptNumber: key } });
    console.log('\nmarketingSale (exact):', mSaleExact ? { id: mSaleExact.id, dailySaleId: mSaleExact.dailySaleId, product: mSaleExact.product, buyingPrice: mSaleExact.buyingPrice } : null);

    const mSaleSub = await p.marketingSale.findFirst({ where: { receiptNumber: { contains: key } } });
    console.log('\nmarketingSale (contains):', mSaleSub ? { id: mSaleSub.id, receiptNumber: mSaleSub.receiptNumber, buyingPrice: mSaleSub.buyingPrice } : null);

    const dSaleExact = await p.dailySale.findMany({ where: { receiptNumber: key }, include: { marketingSales: true, dailyReport: { include: { user: true } } } });
    console.log('\ndailySale (exact count=' + dSaleExact.length + '):'); dSaleExact.forEach(s=>console.log({id:s.id,productName:s.productName,price:s.price,marketingSalesCount:(s.marketingSales||[]).length,dailyReportUser:s.dailyReport?.user?.email}));

    // Also find marketing records that reference the support receipt's dailyEntry if available
    if (support && support.dailyEntryId) {
      const mRecByEntry = await p.marketingReceipt.findMany({ where: { dailyEntryId: support.dailyEntryId }, include: { items: true } });
      console.log('\nmarketingReceipt by dailyEntryId (count=' + mRecByEntry.length + '):'); mRecByEntry.forEach(r=>console.log({id:r.id,receiptNumber:r.receiptNumber, itemsCount: r.items.length}));

      const mSaleByEntry = await p.marketingSale.findMany({ where: { dailySale: { dailyReport: { id: support.dailyEntryId } } } }).catch(()=>null);
      if (mSaleByEntry && mSaleByEntry.length) {
        console.log('\nmarketingSale by dailyEntry linkage (count=' + mSaleByEntry.length + '):'); mSaleByEntry.forEach(s=>console.log({id:s.id,receiptNumber:s.receiptNumber,buyingPrice:s.buyingPrice}));
      }
    }

    process.exit(0);
  } catch (e) {
    console.error('Lookup failed:', e);
    process.exit(1);
  } finally {
    try { await p.$disconnect(); } catch (_) {}
  }
})();
