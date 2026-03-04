require('tsconfig-paths/register');
const { PrismaClient } = require('@prisma/client');
const { sendReceiptChannels } = require('../../.worker-dist/src/workers/receiptSender');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

async function main(){
  try{
    let shop = await prisma.shop.findFirst({ where: { isActive: true } });
    if(!shop) shop = await prisma.shop.create({ data: { name: 'smoke-shop', isActive: true } });
    // Avoid Prisma Product model (may mismatch DB). Query raw to find any product id.
    let productRow = null;
    try {
      productRow = await prisma.$queryRaw`SELECT id FROM "Product" LIMIT 1`;
    } catch (e) {
      // Try lowercase table name fallback
      try {
        productRow = await prisma.$queryRaw`SELECT id FROM product LIMIT 1`;
      } catch (ee) {
        console.warn('Could not locate a Product row via raw SQL. Aborting test.');
        await prisma.$disconnect();
        return;
      }
    }
    const productId = Array.isArray(productRow) && productRow[0] ? productRow[0].id || productRow[0].ID || null : productRow?.id || null;
    if (!productId) {
      console.warn('No existing product found — aborting test. Please create a product in the DB first.');
      await prisma.$disconnect();
      return;
    }
    const orderNumber = `SMOKE-${Date.now()}`;
    const order = await prisma.order.create({ data: { orderNumber, customerName: 'Test Customer', shopId: shop.id, totalAmount: 100, paidAmount: 100, status: 'COMPLETED', paymentStatus: 'PAID' } });
    const orderItem = await prisma.orderItem.create({ data: { orderId: order.id, productId: productId, quantity: 1, sellingPrice: 100 } });
    const receipt = await prisma.receipt.create({ data: { orderId: order.id, receiptNumber: orderNumber, docType: 'RECEIPT', issuedById: null, totals: { subtotal: 100, tax: 0, total: 100, balance: 0 }, data: { items: [{ id: orderItem.id, title: product.name, unitPrice: 100, quantity: 1 }], orderRef: orderNumber }, generatedAt: new Date() } });
    console.log('Created receipt', receipt.id);
    await sendReceiptChannels(receipt.id, ['whatsapp']);
    console.log('sendReceiptChannels done');
  }catch(e){
    console.error('error', e);
  }finally{
    await prisma.$disconnect();
  }
}

main();
