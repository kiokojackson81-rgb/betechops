import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';
import { sendReceiptChannels } from '../src/workers/receiptSender.ts';

async function main() {
  console.info('run-send-test: starting');
  // Create test shop
  const shop = await prisma.shop.create({ data: { name: 'local-test-shop' } });
  // Create order
  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-${Date.now()}`,
      customerName: 'Test Customer',
      shopId: shop.id,
      totalAmount: 1000,
      customerPhone: '+254700000000',
    },
  });
  // Create receipt
  const receipt = await prisma.receipt.create({
    data: {
      orderId: order.id,
      docType: 'RECEIPT',
      generatedAt: new Date(),
      data: { test: true },
    },
  });

  console.info('Created test receipt', { receiptId: receipt.id, orderId: order.id });

  try {
    const res = await sendReceiptChannels(receipt.id, ['whatsapp']);
    console.info('sendReceiptChannels result:', JSON.stringify(res, null, 2));
    const fresh = await prisma.receipt.findUnique({ where: { id: receipt.id } });
    console.info('fresh receipt data:', JSON.stringify(fresh?.data, null, 2));
  } catch (e) {
    console.error('sendReceiptChannels threw', e);
  } finally {
    // cleanup
    await prisma.receipt.delete({ where: { id: receipt.id } }).catch(() => null);
    await prisma.order.delete({ where: { id: order.id } }).catch(() => null);
    await prisma.shop.delete({ where: { id: shop.id } }).catch(() => null);
    console.info('cleaned up test records');
  }
}

main().catch((e) => {
  console.error('Fatal', e);
  process.exit(1);
});
