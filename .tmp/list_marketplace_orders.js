const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rows = await prisma.marketplaceOrder.findMany({ orderBy: { orderedAt: 'desc' }, take: 50 });
    const out = rows.map(r => ({
      id: r.id,
      orderId: r.orderId,
      orderItemId: r.orderItemId,
      accountId: r.accountId,
      status: r.status,
      sellingPrice: r.sellingPrice,
      sellerFee: r.sellerFee,
      shippingFee: r.shippingFee,
      buyingPrice: r.buyingPrice,
      profit: r.profit,
      orderedAt: r.orderedAt,
    }));
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
