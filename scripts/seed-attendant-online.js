const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding attendant online sample data...');

  const shop = await prisma.shop.upsert({
    where: { id: 'seed-shop-1' },
    create: { id: 'seed-shop-1', name: 'Seed Shop', isActive: true },
    update: { name: 'Seed Shop', isActive: true },
  });

  const user = await prisma.user.upsert({
    where: { email: 'seed.attendant@local' },
    create: { id: 'seed-attendant-1', name: 'Seed Attendant', email: 'seed.attendant@local', role: 'ATTENDANT' },
    update: { name: 'Seed Attendant' },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: 'SEED-001',
      customerName: 'Test Customer',
      customerPhone: '0712345678',
      attendantId: user.id,
      shopId: shop.id,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      totalAmount: 1000,
    },
  });

  const receipt = await prisma.receipt.create({
    data: {
      orderId: order.id,
      docType: 'RECEIPT',
      issuedById: user.id,
      generatedAt: new Date(),
      totals: { subtotal: 1000, tax: 0, total: 1000 },
      data: { paymentMethod: 'CASH', attendantId: user.id },
    },
  });

  console.log('Seeded:', { shopId: shop.id, userId: user.id, orderId: order.id, receiptId: receipt.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
