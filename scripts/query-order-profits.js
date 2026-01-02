#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const receiptNumber = process.argv[2];
  if (!receiptNumber) {
    console.error('Usage: node scripts/query-order-profits.js <RECEIPT_NUMBER>');
    process.exitCode = 2;
    return;
  }

  console.log('Searching for receipt -> order -> items -> costs/snapshots for:', receiptNumber);

  const receipt = await prisma.receipt.findFirst({
    where: { receiptNumber },
    include: {
      order: {
        include: {
          items: {
            include: { profitSnapshots: true, orderCosts: true, product: true }
          }
        }
      },
      files: true
    }
  });

  if (!receipt) {
    console.log('No Receipt found for', receiptNumber);
    await prisma.$disconnect();
    return;
  }

  console.log('\n--- Receipt ---');
  console.log(JSON.stringify({ id: receipt.id, orderId: receipt.orderId, receiptNumber: receipt.receiptNumber }, null, 2));

  console.log('\n--- Order (summary) ---');
  if (receipt.order) {
    const o = receipt.order;
    console.log(JSON.stringify({ id: o.id, orderNumber: o.orderNumber, totalAmount: o.totalAmount, attendantId: o.attendantId }, null, 2));

    console.log('\n--- Order Items ---');
    for (const it of o.items) {
      console.log(JSON.stringify({ id: it.id, productId: it.productId, quantity: it.quantity, sellingPrice: it.sellingPrice, product: it.product ? { id: it.product.id, sku: it.product.sku, lastBuyingPrice: it.product.lastBuyingPrice } : null }, null, 2));

      console.log('  orderCosts:', JSON.stringify(it.orderCosts || [], null, 2));
      console.log('  profitSnapshots:', JSON.stringify(it.profitSnapshots || [], null, 2));
    }
  } else {
    console.log('No Order linked to receipt');
  }

  // Also look for standalone ProfitSnapshot or OrderCost rows by receipt order items
  const orderItemIds = receipt.order?.items.map(i => i.id) || [];
  if (orderItemIds.length) {
    const snaps = await prisma.profitSnapshot.findMany({ where: { orderItemId: { in: orderItemIds } } });
    const costs = await prisma.orderCost.findMany({ where: { orderItemId: { in: orderItemIds } } });
    console.log('\n--- ProfitSnapshots (by order items) ---');
    console.log(JSON.stringify(snaps, null, 2));
    console.log('\n--- OrderCosts (by order items) ---');
    console.log(JSON.stringify(costs, null, 2));
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  prisma.$disconnect();
  process.exitCode = 1;
});
