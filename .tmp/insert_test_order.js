const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const account = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: { not: null } } });
    if (!account) {
      console.log('no marketplace account');
      process.exit(0);
    }
    const data = {
      id: 'test-order-1',
      accountId: account.id,
      platform: 'JUMIA',
      orderId: 'test-order-1-ord',
      orderItemId: 'test-order-1-item',
      status: 'DELIVERED',
      orderedAt: new Date(),
      productName: 'Test product',
      sellingPrice: 100.0,
      currency: 'KES',
      rawPayload: {},
    };
    const r = await prisma.marketplaceOrder.create({ data });
    console.log('created', r.id);
  } catch (err) {
    console.error('create failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
