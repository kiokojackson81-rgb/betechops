#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeReceiptNumber(input) {
  if (input == null) return '';
  const s = String(input);
  const trimmed = s.trim();
  if (!trimmed) return '';
  let out = trimmed.toUpperCase().replace(/[\s\-_]+/g, '');
  out = out.replace(/[^A-Z0-9]/g, '');
  return out;
}

function buildReceiptKey(raw, fallback) {
  const n = normalizeReceiptNumber(raw);
  if (n) return n;
  if (fallback) return `ID:${String(fallback)}`;
  return '';
}

async function main() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(end.getDate()+1);

  console.log('Period:', start.toISOString(), '->', new Date(end.getTime()-1).toISOString());

  const [marketingRows, supportRows] = await Promise.all([
    prisma.marketingReceipt.findMany({ where: { createdAt: { gte: start, lt: end } }, select: { id: true, receiptNumber: true, receiptKey: true, sellingTotal: true, buyingTotal: true, paymentMethod: true, createdAt: true } }),
    prisma.supportReceipt.findMany({ where: { createdAt: { gte: start, lt: end } }, select: { id: true, receiptNumber: true, receiptKey: true, sellingTotal: true, buyingTotal: true, paymentMethod: true, createdAt: true } }),
  ]);

  const summarize = (rows) => {
    let totalSales = 0, totalProfit = 0;
    const per = new Map();
    for (const r of rows) {
      const sales = Number(r.sellingTotal ?? 0);
      const profit = Math.max(0, sales - Number(r.buyingTotal ?? 0));
      totalSales += sales;
      totalProfit += profit;
      const key = String(r.receiptKey ?? buildReceiptKey(r.receiptNumber ?? null, r.id));
      if (!per.has(key)) per.set(key, { sales: 0, profit: 0, mpesa: 0, cash: 0, count: 0 });
      const cur = per.get(key);
      cur.sales += sales;
      cur.profit += profit;
      if ((r.paymentMethod || '').toUpperCase() === 'CASH') cur.cash += sales; else cur.mpesa += sales;
      cur.count += 1;
    }
    return { totalSales, totalProfit, per };
  };

  const m = summarize(marketingRows);
  const s = summarize(supportRows);

  const merged = new Map();
  for (const [k, v] of m.per.entries()) merged.set(k, { ...v });
  for (const [k, v] of s.per.entries()) {
    if (merged.has(k)) continue; // marketing wins
    merged.set(k, { ...v });
  }

  let mergedSales = 0, mergedProfit = 0, mergedItems = 0;
  let mpesa = 0, cash = 0;
  for (const [,v] of merged.entries()) {
    mergedSales += v.sales; mergedProfit += v.profit; mergedItems += v.count; mpesa += v.mpesa; cash += v.cash;
  }

  console.log('\nMarketing totals rows:', marketingRows.length, 'sales:', m.totalSales, 'profit:', m.totalProfit, 'perReceipts:', m.per.size);
  console.log('Support totals rows:', supportRows.length, 'sales:', s.totalSales, 'profit:', s.totalProfit, 'perReceipts:', s.per.size);
  console.log('Merged totals (marketing wins): receipts:', merged.size, 'sales:', mergedSales, 'profit:', mergedProfit, 'items:', mergedItems);
  console.log('Payment breakdown mpesa:', mpesa, 'cash:', cash);

  // show sample intersections (receiptKeys present in both)
  const intersections = [];
  for (const k of m.per.keys()) if (s.per.has(k)) intersections.push(k);
  console.log('\nIntersections count:', intersections.length, 'sample:', intersections.slice(0,20));

  await prisma.$disconnect();
}

main().catch(err=>{ console.error(err); process.exit(1); });
