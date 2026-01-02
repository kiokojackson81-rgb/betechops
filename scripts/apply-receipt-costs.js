#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const receiptNumber = process.argv[2];
  const costsArg = process.argv[3];
  if (!receiptNumber || !costsArg) {
    console.error('Usage: node scripts/apply-receipt-costs.js <RECEIPT_NUMBER> <comma-separated-unit-costs-per-order-item>');
    process.exitCode = 2;
    return;
  }

  const unitCosts = costsArg.split(',').map(s => Number(s.trim()));
  if (unitCosts.some(c => !Number.isFinite(c))) {
    console.error('Invalid costs provided');
    process.exitCode = 2;
    return;
  }

  console.log('Applying costs for', receiptNumber, 'unitCosts=', unitCosts);

  const receipt = await prisma.receipt.findFirst({ where: { receiptNumber }, include: { order: { include: { items: { include: { product: true } } } } } });
  if (!receipt) {
    console.error('Receipt not found:', receiptNumber);
    process.exitCode = 1;
    return;
  }
  if (!receipt.order) {
    console.error('Receipt has no linked order');
    process.exitCode = 1;
    return;
  }

  const items = receipt.order.items;
  if (unitCosts.length !== items.length) {
    console.error('Unit costs length', unitCosts.length, "doesn't match order items", items.length);
    console.error('Order items ids:', items.map(i=>i.id));
    process.exitCode = 1;
    return;
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const unitCost = unitCosts[i];

    // Skip if OrderCost exists
    const existingCost = await prisma.orderCost.findFirst({ where: { orderItemId: it.id } });
    if (!existingCost) {
      await prisma.orderCost.create({ data: { orderItemId: it.id, unitCost: unitCost, costSource: 'manual-import' } });
      console.log('Inserted OrderCost for', it.id, 'unitCost=', unitCost);
    } else {
      console.log('OrderCost exists for', it.id, 'skipping');
    }

    // Create ProfitSnapshot if missing
    const existingSnap = await prisma.profitSnapshot.findFirst({ where: { orderItemId: it.id } });
    if (!existingSnap) {
      const revenue = Number(it.sellingPrice) * Number(it.quantity);
      const unitCostDec = Number(unitCost);
      const profit = revenue - unitCostDec * Number(it.quantity);
      await prisma.profitSnapshot.create({ data: { orderItemId: it.id, revenue, fees: 0, shipping: 0, refunds: 0, unitCost: unitCostDec, qty: Number(it.quantity), profit } });
      console.log('Inserted ProfitSnapshot for', it.id, 'revenue=', revenue, 'unitCost=', unitCostDec, 'profit=', profit);
    } else {
      console.log('ProfitSnapshot exists for', it.id, 'skipping');
    }
  }

  await prisma.$disconnect();
}

main().catch(err => { console.error('ERR', err); prisma.$disconnect(); process.exitCode = 1; });
