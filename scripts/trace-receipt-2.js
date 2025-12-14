const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const key = process.argv[2] || 'Betech-20251210-19935';
    console.log('Searching substring:', key);

    const mRec = await p.marketingReceipt.findFirst({ where: { receiptNumber: { contains: key } }, include: { items: true, dailyEntry: { include: { submittedBy: true } } } });
    console.log('\nmarketingReceipt:', mRec ? { id: mRec.id, receiptNumber: mRec.receiptNumber, sellingTotal: mRec.sellingTotal, items: mRec.items.map(i=>({id:i.id,productName:i.productName,buyingPrice:i.buyingPrice})) } : null);

    const sRec = await p.supportReceipt.findFirst({ where: { receiptNumber: { contains: key } }, include: { items: true, dailyEntry: { include: { submittedBy: true } } } });
    console.log('\nsupportReceipt:', sRec ? { id: sRec.id, receiptNumber: sRec.receiptNumber, sellingTotal: sRec.sellingTotal, items: sRec.items.map(i=>({id:i.id,productName:i.productName,buyingPrice:i.buyingPrice})) } : null);

    const dSales = await p.dailySale.findMany({ where: { receiptNumber: { contains: key } }, include: { dailyReport: { include: { user: true } }, marketingSales: true } });
    console.log('\ndailySales (count=' + dSales.length + '):');
    dSales.forEach(s => console.log({ id: s.id, productName: s.productName, price: s.price, marketingSalesCount: (s.marketingSales||[]).length, dailyReportUser: s.dailyReport?.user?.email }));

    const mSales = await p.marketingSale.findMany({ where: { receiptNumber: { contains: key } } });
    console.log('\nmarketingSales (count=' + mSales.length + '):');
    mSales.forEach(s => console.log({ id: s.id, dailySaleId: s.dailySaleId, product: s.product, buyingPrice: s.buyingPrice, sellingPrice: s.sellingPrice }));

    process.exit(0);
  } catch (e) {
    console.error('Search failed:', e);
    process.exit(1);
  } finally {
    try { await p.$disconnect(); } catch (_) {}
  }
})();
