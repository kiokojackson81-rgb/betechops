import { prisma } from '../../src/lib/prisma';
import { sendReceiptChannels } from '../../src/workers/receiptSender';
import { randomUUID } from 'crypto';

async function main() {
  try {
    // find or create a shop
    let shop = await prisma.shop.findFirst({ where: { isActive: true } });
    if (!shop) {
      shop = await prisma.shop.create({ data: { name: 'smoke-shop', isActive: true } });
    }

    // create a product
    const product = await prisma.product.create({ data: { sku: `smoke-${randomUUID().slice(0,8)}`, name: 'Smoke Item', category: 'manual', sellingPrice: 100 } });

    // create order
    const orderNumber = `SMOKE-${Date.now()}`;
    const order = await prisma.order.create({ data: { orderNumber, customerName: 'Test Customer', shopId: shop.id, totalAmount: 100, paidAmount: 100, status: 'COMPLETED', paymentStatus: 'PAID' } });

    // create order item
    const orderItem = await prisma.orderItem.create({ data: { orderId: order.id, productId: product.id, quantity: 1, sellingPrice: 100 } });

    // create receipt
    const receipt = await prisma.receipt.create({ data: { orderId: order.id, receiptNumber: orderNumber, docType: 'RECEIPT', issuedById: null, totals: { subtotal: 100, tax: 0, total: 100, balance: 0 }, data: { items: [{ id: orderItem.id, title: product.name, unitPrice: 100, quantity: 1 }], orderRef: orderNumber }, generatedAt: new Date() } as any });

    console.log('Created test receipt', receipt.id);

    // call sendReceiptChannels
    await sendReceiptChannels(receipt.id, ['whatsapp']);
    console.log('sendReceiptChannels completed');
  } catch (err) {
    console.error('test send failed', err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
