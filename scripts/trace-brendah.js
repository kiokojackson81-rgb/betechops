const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const email = process.argv[2] || 'brendah@betech.co.ke';
    const user = await p.user.findUnique({ where: { email } });
    if (!user) {
      console.log('User not found for', email);
      process.exit(2);
    }
    console.log('User:', { id: user.id, email: user.email, name: user.name });

    const marketingReceipts = await p.marketingReceipt.findMany({
      where: { dailyEntry: { submittedById: user.id } },
      include: { items: true, dailyEntry: true },
      orderBy: { createdAt: 'asc' },
    });

    console.log('\nMarketing receipts (count=' + marketingReceipts.length + '):');
    marketingReceipts.forEach((r) => {
      console.log({ id: r.id, receiptNumber: r.receiptNumber, sellingTotal: r.sellingTotal, paymentMethod: r.paymentMethod, createdAt: r.createdAt, itemsCount: (r.items || []).length });
      (r.items || []).forEach((it) => console.log('  item:', { id: it.id, productName: it.productName, buyingPrice: it.buyingPrice }));
    });

    const marketingSales = await p.marketingSale.findMany({
      where: { entry: { submittedById: user.id } },
      include: { entry: true },
      orderBy: { createdAt: 'asc' },
    });
    console.log('\nMarketing sales (count=' + marketingSales.length + '):');
    marketingSales.forEach((s) => console.log({ id: s.id, dailySaleId: s.dailySaleId, product: s.product, buyingPrice: s.buyingPrice, sellingPrice: s.sellingPrice, receiptNumber: s.receiptNumber, createdAt: s.createdAt }));

    const dailyReports = await p.dailyReport.findMany({ where: { userId: user.id }, include: { sales: true }, orderBy: { date: 'asc' } });
    console.log('\nDaily reports (count=' + dailyReports.length + '):');
    dailyReports.forEach((d) => {
      console.log({ id: d.id, date: d.date, totalSales: d.totalSales });
      (d.sales || []).forEach((s) => console.log('  sale:', { id: s.id, productName: s.productName, price: s.price, receiptNumber: s.receiptNumber }));
    });

    const commissionLedgers = await p.commissionLedger.findMany({ where: { userId: user.id }, orderBy: { periodStart: 'desc' } });
    console.log('\nCommission ledger entries (count=' + commissionLedgers.length + '):');
    commissionLedgers.forEach((l) => console.log({ id: l.id, periodStart: l.periodStart, periodEnd: l.periodEnd, grossCommission: l.grossCommission, netCommission: l.netCommission, detail: l.detail ? (l.detail.marketing ? { marketingCommission: l.detail.marketing.commission, totals: l.detail.marketing.totals } : l.detail) : null }));

    // Find any dailySale entries that are not yet priced (no marketingSale) within user's reports
    const unpricedDailySales = await p.dailySale.findMany({
      where: { dailyReport: { userId: user.id }, NOT: { marketingSales: { some: {} } } },
      orderBy: { createdAt: 'asc' },
    });
    console.log('\nUnpriced dailySales for this user (count=' + unpricedDailySales.length + '):');
    unpricedDailySales.forEach((s) => console.log({ id: s.id, productName: s.productName, price: s.price, receiptNumber: s.receiptNumber }));

    process.exit(0);
  } catch (e) {
    console.error('Query failed:', e);
    process.exit(1);
  } finally {
    try { await p.$disconnect(); } catch (_) {}
  }
})();
