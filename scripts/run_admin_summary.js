const { PrismaClient } = require('@prisma/client');

function parseDateParam(value, fallback, toEnd = false) {
  if (!value) return toEnd ? endOfDay(fallback) : startOfDay(fallback);
  const isPlainYMD = /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.includes('T');
  try {
    if (isPlainYMD) {
      const iso = toEnd ? `${value}T23:59:59.999+03:00` : `${value}T00:00:00+03:00`;
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) throw new Error('invalid date');
      return parsed;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return toEnd ? endOfDay(fallback) : startOfDay(fallback);
    return parsed;
  } catch (err) {
    return toEnd ? endOfDay(fallback) : startOfDay(fallback);
  }
}

function startOfDay(value) {
  const clone = new Date(value);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function endOfDay(value) {
  const clone = new Date(value);
  clone.setHours(23, 59, 59, 999);
  return clone;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const startParam = '2025-12-12';
    const endParam = '2025-12-12';
    const today = new Date();
    const start = parseDateParam(startParam, startOfDay(today));
    const end = parseDateParam(endParam, endOfDay(today), true);

    const dailyEntryFilter = { date: { gte: start, lte: end } };

    const [marketingReceipts, supportReceipts] = await Promise.all([
      prisma.marketingReceipt.findMany({ where: { dailyEntry: dailyEntryFilter }, include: { items: true } }),
      prisma.supportReceipt.findMany({ where: { dailyEntry: dailyEntryFilter }, include: { items: true } }),
    ]);

    const combined = [
      ...marketingReceipts.map((receipt) => ({ ...receipt, type: 'marketing' })),
      ...supportReceipts.map((receipt) => ({ ...receipt, type: 'support' })),
    ];
    const receiptMap = new Map();
    for (const r of combined) {
      const key = r.receiptNumber ? `num:${String(r.receiptNumber)}` : `id:${r.type}:${r.id}`;
      const existing = receiptMap.get(key);
      if (!existing) {
        receiptMap.set(key, r);
        continue;
      }
      if (existing.type === 'marketing' && r.type === 'support') {
        receiptMap.set(key, r);
      }
    }
    const allReceipts = Array.from(receiptMap.values());

    let totalSales = 0;
    let itemsCount = 0;
    for (const receipt of allReceipts) {
      const sale = Number(receipt.sellingTotal ?? 0);
      totalSales += sale;
      const items = Array.isArray(receipt.items) ? receipt.items : [];
      itemsCount += items.reduce((s, it) => s + (Number(it.quantity ?? 1) || 0), 0);
    }

    const receiptsCount = allReceipts.length;
    let totalProfit = 0;
    let totalCost = 0;
    let awaitingPricingCount = 0;

    for (const receipt of allReceipts) {
      const items = Array.isArray(receipt.items) ? receipt.items : [];
      const buyingSum = items.reduce((s, it) => s + Number(it.buyingPrice ?? 0), 0);
      totalCost += buyingSum;
      const sell = Number(receipt.sellingTotal ?? 0);
      totalProfit += sell - buyingSum;
      if (items.length === 0 || items.some((it) => it.buyingPrice === null || it.buyingPrice === undefined)) {
        awaitingPricingCount += 1;
      }
    }

    const result = {
      totalSales,
      totalCost,
      totalProfit,
      receiptsCount,
      itemsCount,
      hasCompleteCosts: allReceipts.length === 0 ? true : !allReceipts.some((r) => (Array.isArray(r.items) ? r.items : []).some((it) => it.buyingPrice === null || it.buyingPrice === undefined)),
      awaitingPricingCount,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('ERROR', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();
