#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const marketplaceOrderId = 'cmjxq30620001v51sv3nk3url';
  const order = await prisma.marketplaceOrder.findUnique({ where: { id: marketplaceOrderId } });
  if (!order) {
    console.error('MarketplaceOrder not found:', marketplaceOrderId);
    return;
  }
  const amount = Number(order.profit ?? 0);
  console.log('Creating ProfitEvent for', marketplaceOrderId, 'amount', amount);
  try {
    const ev = await prisma.profitEvent.create({ data: { marketplaceOrderId, type: 'RECOGNISE', amount } });
    console.log('Created ProfitEvent:', ev);
  } catch (err) {
    console.error('Failed to create ProfitEvent:', err.message || err);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
