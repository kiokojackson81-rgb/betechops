const { PrismaClient } = require('@prisma/client');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Please set DATABASE_URL env var');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const receiptId = process.argv[2] || 'Betech-20260130-58585';
  console.log('Inspecting receipt:', receiptId);

  // Try several lookup strategies: id, receiptNumber, order.orderNumber, data.orderRef
  let receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, include: { order: true } });
  if (!receipt) {
    const matches = await prisma.receipt.findMany({
      where: {
        OR: [
          { receiptNumber: receiptId },
          { order: { orderNumber: receiptId } },
          { data: { path: ['orderRef'], equals: receiptId } },
          { data: { path: ['receiptNumber'], equals: receiptId } },
        ],
      },
      include: { order: true },
      take: 5,
    });
    if (matches && matches.length === 1) receipt = matches[0];
    else if (matches && matches.length > 1) {
      console.warn('Multiple receipts matched; showing first 5');
      console.log(JSON.stringify(matches.map(m => ({ id: m.id, receiptNumber: m.receiptNumber, orderNumber: m.order?.orderNumber, pod: m.data?.podDelivery })), null, 2));
      await prisma.$disconnect();
      process.exit(3);
    }
  }
  if (!receipt) {
    console.error('Receipt not found');
    await prisma.$disconnect();
    process.exit(2);
  }

  console.log('\n== receipt.data.podDelivery ==');
  console.log(JSON.stringify((receipt.data && receipt.data.podDelivery) || null, null, 2));

  console.log('\n== receipt.order (summary) ==');
  console.log(JSON.stringify(receipt.order || null, null, 2));

  const orderNumber = receipt.order?.orderNumber || null;
  if (orderNumber) {
    console.log('\nSearching marketingReceipt/supportReceipt by receiptKey/orderRef...');

    const normalized = orderNumber.replace(/[^0-9A-Za-z:\-]/g, '');

    // Find marketingReceipt(s)
    try {
      const marketing = await prisma.marketingReceipt.findMany({ where: { OR: [ { receiptNumber: orderNumber }, { receiptKey: orderNumber } ] } });
      console.log('\n== marketingReceipt matches ==');
      console.log(JSON.stringify(marketing, null, 2));
    } catch (e) {
      console.warn('marketingReceipt lookup failed', e.message || e);
    }

    try {
      const support = await prisma.supportReceipt.findMany({ where: { OR: [ { receiptNumber: orderNumber }, { receiptKey: orderNumber } ] } });
      console.log('\n== supportReceipt matches ==');
      console.log(JSON.stringify(support, null, 2));
    } catch (e) {
      console.warn('supportReceipt lookup failed', e.message || e);
    }
  }

  // Commission/earning rows
  try {
    const earnings = await prisma.commissionEarning.findMany({ where: { orderItem: { order: { id: receipt.orderId } } }, take: 100 });
    console.log('\n== commissionEarning rows for order ==');
    console.log(JSON.stringify(earnings, null, 2));
  } catch (e) {
    console.warn('commissionEarning lookup failed', e.message || e);
  }

  try {
    const record = await prisma.commissionRecord.findMany({ where: { orderId: receipt.orderId } });
    console.log('\n== commissionRecord for order ==');
    console.log(JSON.stringify(record, null, 2));
  } catch (e) {
    console.warn('commissionRecord lookup failed', e.message || e);
  }

  try {
    const receiptFiles = await prisma.receiptFile.findMany({ where: { receiptId: receiptId } });
    console.log('\n== receiptFile entries ==');
    console.log(JSON.stringify(receiptFiles, null, 2));
  } catch (e) {
    console.warn('receiptFile lookup failed', e.message || e);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Unexpected error', e);
  process.exit(1);
});
