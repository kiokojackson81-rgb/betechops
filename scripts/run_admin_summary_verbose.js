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
      ...marketingReceipts.map((r) => ({ ...r, type: 'marketing' })),
      ...supportReceipts.map((r) => ({ ...r, type: 'support' })),
    ];
    const receiptMap = new Map();
    for (const r of combined) {
      const key = r.receiptNumber ? `num:${String(r.receiptNumber)}` : `id:${r.type}:${r.id}`;
      if (receiptMap.has(key)) continue;
      receiptMap.set(key, r);
    }
    const allReceipts = Array.from(receiptMap.values());

    const out = allReceipts.map((r) => ({
      id: r.id,
      type: r.type,
      receiptNumber: r.receiptNumber,
      sellingTotal: r.sellingTotal,
      buyingTotal: r.buyingTotal ?? null,
      items: (r.items || []).map((it) => ({ id: it.id, productName: it.productName, buyingPrice: it.buyingPrice })),
    }));

    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('ERROR', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();
