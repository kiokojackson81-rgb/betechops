#!/usr/bin/env node
const { PrismaClient, PaymentMethod } = require('@prisma/client');
const prisma = new PrismaClient();

function canonicalReceiptNumber(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.replace(/\s|-/g, '').toUpperCase();
}

function businessDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildReceiptKey(entryDate, serial) {
  const canonical = canonicalReceiptNumber(serial);
  if (!canonical) return null;
  return `${businessDateKey(entryDate)}:${canonical}`;
}

async function upsertMarketingReceipt({ date, serial, paymentMethod, items }) {
  const entryDate = date || new Date();
  const receiptSellingTotal = items.reduce((s, it) => s + (Number(it.sellingPrice || it.unitPrice || 0) * (it.quantity || 1)), 0);
  const receiptBuyingTotal = items.reduce((s, it) => s + (Number(it.buyingPrice || it.costPrice || 0) * (it.quantity || 1)), 0);
  const normalizedSerial = canonicalReceiptNumber(serial);
  const receiptKey = buildReceiptKey(entryDate, serial);
  // create a dedicated daily entry for this test if not exists
  let entry = await prisma.marketingDailyEntry.create({ data: { date: entryDate, dayOfWeek: entryDate.toLocaleDateString('en-KE', { weekday: 'long' }), totalSales: 0, totalProfit: 0, submittedByName: 'local-verify' } });

  let deltaSales = receiptSellingTotal;
  let deltaProfit = receiptSellingTotal - receiptBuyingTotal;

  if (receiptKey) {
    const prev = await prisma.marketingReceipt.findUnique({ where: { receiptKey }, select: { sellingTotal: true, buyingTotal: true } });
    const prevSelling = Number(prev?.sellingTotal ?? 0);
    const prevBuying = Number(prev?.buyingTotal ?? 0);
    deltaSales = receiptSellingTotal - prevSelling;
    deltaProfit = (receiptSellingTotal - receiptBuyingTotal) - (prevSelling - prevBuying);

    await prisma.marketingReceipt.upsert({
      where: { receiptKey },
      create: {
        dailyEntryId: entry.id,
        receiptNumber: normalizedSerial || undefined,
        receiptKey,
        paymentMethod: paymentMethod === 'CASH' ? PaymentMethod.CASH : PaymentMethod.MPESA,
        sellingTotal: receiptSellingTotal,
        buyingTotal: receiptBuyingTotal,
        items: items.length ? { create: items.map(i => ({ productName: i.productName || 'item', buyingPrice: Number(i.buyingPrice || i.costPrice || 0) })) } : undefined,
      },
      update: {
        paymentMethod: paymentMethod === 'CASH' ? PaymentMethod.CASH : PaymentMethod.MPESA,
        sellingTotal: receiptSellingTotal,
        buyingTotal: receiptBuyingTotal,
        items: { deleteMany: {}, ...(items.length ? { create: items.map(i => ({ productName: i.productName || 'item', buyingPrice: Number(i.buyingPrice || i.costPrice || 0) })) } : {}) },
      },
    });
  } else {
    await prisma.marketingReceipt.create({ data: { dailyEntryId: entry.id, receiptNumber: null, receiptKey: null, sellingTotal: receiptSellingTotal, buyingTotal: receiptBuyingTotal, paymentMethod: paymentMethod === 'CASH' ? PaymentMethod.CASH : PaymentMethod.MPESA, items: items.length ? { create: items.map(i => ({ productName: i.productName || 'item', buyingPrice: Number(i.buyingPrice || i.costPrice || 0) })) } : undefined } });
  }

  if ((deltaSales || deltaProfit) && entry.id) {
    await prisma.marketingDailyEntry.update({ where: { id: entry.id }, data: { totalSales: { increment: deltaSales }, totalProfit: { increment: deltaProfit } } });
  }

  const updated = await prisma.marketingDailyEntry.findUnique({ where: { id: entry.id } });
  return { entryId: entry.id, totalSales: updated.totalSales, totalProfit: updated.totalProfit, deltaSales, deltaProfit };
}

async function main() {
  try {
    const date = new Date();
    const serial = 'TEST-100';
    const paymentMethod = 'MPESA';
    const items = [{ productName: 'Widget', sellingPrice: 1000, buyingPrice: 700, quantity: 1 }];

    console.log('First submission...');
    const r1 = await upsertMarketingReceipt({ date, serial, paymentMethod, items });
    console.log('After first:', r1);

    console.log('Second submission (same serial)...');
    const r2 = await upsertMarketingReceipt({ date, serial, paymentMethod, items });
    console.log('After second:', r2);

    console.log('Delta between runs:', { first: { sales: r1.totalSales, profit: r1.totalProfit }, second: { sales: r2.totalSales, profit: r2.totalProfit } });
  } catch (err) {
    console.error('Error during local verify', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
