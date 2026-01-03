#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // seeded order uses this test item id
  const orderItemId = 'TEST-ORDER-ITEM-1';
  const buyingPrice = 1200;

  console.log('Looking up marketplace order by orderItemId:', orderItemId);
  const order = await prisma.marketplaceOrder.findFirst({ where: { orderItemId } });
  if (!order) {
    console.error('Order not found');
    return;
  }

  console.log('Order before:', JSON.stringify({ id: order.id, sellingPrice: order.sellingPrice, buyingPrice: order.buyingPrice, sellerFee: order.sellerFee, shippingFee: order.shippingFee, profit: order.profit }, null, 2));

  // Determine fee/shipping (prefer stored columns, fallback to rawPayload)
  const raw = order.rawPayload || {};
  const fee = Number(order.sellerFee ?? (raw?.seller_fee?.amount ?? raw?.seller_fee_amount ?? 0)) || 0;
  const shipping = Number(order.shippingFee ?? (raw?.shipping_fee?.amount ?? raw?.shipping_fee_amount ?? 0)) || 0;
  const sellingPrice = Number(order.sellingPrice ?? 0);

  const profit = sellingPrice - fee - shipping - Math.round(buyingPrice);

  // find a user to set as pricedById if possible
  const user = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'SUPERVISOR'] } } });
  const pricedById = user ? user.id : null;

  await prisma.marketplaceOrder.update({ where: { id: order.id }, data: { buyingPrice: Math.round(buyingPrice), profit, pricedById, pricedAt: new Date() } });

  try {
    await prisma.profitEvent.create({ data: { marketplaceOrderId: order.id, type: 'RECOGNISE', amount: profit } });
    console.log('Created ProfitEvent for order.');
  } catch (err) {
    console.warn('Warning: could not create ProfitEvent (enum/migration may be missing):', err && err.message ? err.message : err);
  }

  console.log('Updated order (ProfitEvent creation attempted):');
  const updated = await prisma.marketplaceOrder.findUnique({ where: { id: order.id } });
  console.log(JSON.stringify({ id: updated.id, sellingPrice: updated.sellingPrice, buyingPrice: updated.buyingPrice, sellerFee: updated.sellerFee, shippingFee: updated.shippingFee, profit: updated.profit, pricedById: updated.pricedById }, null, 2));

  const events = await prisma.profitEvent.findMany({ where: { marketplaceOrderId: order.id }, orderBy: { createdAt: 'asc' } });
  console.log('ProfitEvents:');
  console.log(JSON.stringify(events, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
