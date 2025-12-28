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

  // Additional attendants for UI testing
  const user2 = await prisma.user.upsert({
    where: { email: 'seed.attendant2@local' },
    create: { id: 'seed-attendant-2', name: 'Seed Attendant 2', email: 'seed.attendant2@local', role: 'ATTENDANT' },
    update: { name: 'Seed Attendant 2' },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'seed.attendant3@local' },
    create: { id: 'seed-attendant-3', name: 'Seed Attendant 3', email: 'seed.attendant3@local', role: 'ATTENDANT' },
    update: { name: 'Seed Attendant 3' },
  });

  // create or get order/receipt for primary attendant
  let order = await prisma.order.findUnique({ where: { orderNumber: 'SEED-001' } });
  if (!order) {
    order = await prisma.order.create({
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
  }

  let receipt = await prisma.receipt.findFirst({ where: { orderId: order.id } });
  if (!receipt) {
    receipt = await prisma.receipt.create({
      data: {
        orderId: order.id,
        docType: 'RECEIPT',
        issuedById: user.id,
        generatedAt: new Date(),
        totals: { subtotal: 1000, tax: 0, total: 1000 },
        data: { paymentMethod: 'CASH', attendantId: user.id },
      },
    });
  }

  // Create simple orders/receipts for the other attendants
  try {
    let order2 = await prisma.order.findUnique({ where: { orderNumber: 'SEED-002' } });
    if (!order2) {
      order2 = await prisma.order.create({
        data: {
          orderNumber: 'SEED-002',
          customerName: 'Customer 2',
          customerPhone: '0722222222',
          attendantId: user2.id,
          shopId: shop.id,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          totalAmount: 1500,
        },
      });
    }
    let r2 = await prisma.receipt.findFirst({ where: { orderId: order2.id } });
    if (!r2) {
      await prisma.receipt.create({
        data: {
          orderId: order2.id,
          docType: 'RECEIPT',
          issuedById: user2.id,
          generatedAt: new Date(),
          totals: { subtotal: 1500, tax: 0, total: 1500 },
          data: { paymentMethod: 'MPESA', attendantId: user2.id },
        },
      });
    }

    let order3 = await prisma.order.findUnique({ where: { orderNumber: 'SEED-003' } });
    if (!order3) {
      order3 = await prisma.order.create({
        data: {
          orderNumber: 'SEED-003',
          customerName: 'Customer 3',
          customerPhone: '0733333333',
          attendantId: user3.id,
          shopId: shop.id,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          totalAmount: 2000,
        },
      });
    }
    let r3 = await prisma.receipt.findFirst({ where: { orderId: order3.id } });
    if (!r3) {
      await prisma.receipt.create({
        data: {
          orderId: order3.id,
          docType: 'RECEIPT',
          issuedById: user3.id,
          generatedAt: new Date(),
          totals: { subtotal: 2000, tax: 0, total: 2000 },
          data: { paymentMethod: 'CASH', attendantId: user3.id },
        },
      });
    }
  } catch (e) {
    console.warn('Failed to create additional POS receipts (schema may differ):', e.message || e);
  }

  // Create marketing and support daily entries + receipts (best-effort)
  try {
    const mEntry = await prisma.marketingDailyEntry.create({
      data: {
        date: new Date(),
        dayOfWeek: new Date().toLocaleDateString('en-KE', { weekday: 'long' }),
        submittedById: user2.id,
        submittedByName: user2.name,
        submittedByEmail: user2.email,
        totalSales: 1500,
        totalProfit: 500,
      },
    });
    await prisma.marketingReceipt.create({
      data: {
        dailyEntryId: mEntry.id,
        receiptNumber: 'MKT-001',
        receiptKey: 'mkt-seed-1',
        paymentMethod: 'MPESA',
        sellingTotal: 1500,
        buyingTotal: 1000,
        items: { create: [{ productName: 'Seed Product A', buyingPrice: 1000 }] },
      },
    });
  } catch (e) {
    console.warn('Marketing seed skipped or failed:', e.message || e);
  }

  try {
    const sEntry = await prisma.supportDailyEntry.create({
      data: {
        date: new Date(),
        dayOfWeek: new Date().toLocaleDateString('en-KE', { weekday: 'long' }),
        submittedById: user3.id,
        submittedByName: user3.name,
        totalSales: 2000,
        totalProfit: 800,
      },
    });
    await prisma.supportReceipt.create({
      data: {
        dailyEntryId: sEntry.id,
        receiptNumber: 'SUP-001',
        receiptKey: 'sup-seed-1',
        paymentMethod: 'CASH',
        sellingTotal: 2000,
        buyingTotal: 1200,
        items: { create: [{ productName: 'Seed Support Item', buyingPrice: 1200 }] },
      },
    });
  } catch (e) {
    console.warn('Support seed skipped or failed:', e.message || e);
  }

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
