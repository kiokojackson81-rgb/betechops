#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['warn','error'] });

function toNumber(v) { return Number(v ?? 0) || 0; }
function sumItemQuantities(items) { return (items || []).reduce((s, it) => s + (Number(it?.quantity ?? 1) || 0), 0); }

async function analyzeRange(fromIso, toIso) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  console.log(`\n=== RANGE ${from.toISOString()} -> ${to.toISOString()} ===`);

  const marketing = await prisma.marketingReceipt.findMany({ where: { dailyEntry: { date: { gte: from, lte: to } } }, include: { items: true }, orderBy: { id: 'asc' } });
  const support = await prisma.supportReceipt.findMany({ where: { dailyEntry: { date: { gte: from, lte: to } } }, include: { items: true }, orderBy: { id: 'asc' } });
  const pos = await prisma.receipt.findMany({ where: { generatedAt: { gte: from, lte: to } }, include: { order: { include: { items: { select: { quantity: true } } } } }, orderBy: { id: 'asc' } });

  const marketingAgg = { totalSales: 0, totalProfit: 0, count: marketing.length, itemsCount: 0 };
  const missingCosts = [];
  for (const r of marketing) {
    const sell = toNumber(r.sellingTotal);
    marketingAgg.totalSales += sell;
    const items = r.items || [];
    marketingAgg.itemsCount += items.length;
    const aggregateCost = toNumber(r.buyingTotal);
    const allItemsPriced = items.length > 0 && items.every((it) => toNumber(it?.buyingPrice) > 0);
    const hasAggregate = aggregateCost > 0;
    if (hasAggregate || allItemsPriced) {
      const buyingSum = hasAggregate ? aggregateCost : items.reduce((s, it) => s + toNumber(it?.buyingPrice), 0);
      marketingAgg.totalProfit += sell - buyingSum;
    } else {
      missingCosts.push({ id: r.id, date: r.generatedAt || r.createdAt || null, sellingTotal: sell, itemsCount: items.length });
    }
  }

  const supportAgg = { totalSales: 0, totalProfit: 0, count: support.length, itemsCount: 0 };
  for (const r of support) {
    const sell = toNumber(r.sellingTotal);
    supportAgg.totalSales += sell;
    const items = r.items || [];
    supportAgg.itemsCount += items.length;
    const aggregateCost = toNumber(r.buyingTotal);
    const allItemsPriced = items.length > 0 && items.every((it) => toNumber(it?.buyingPrice) > 0);
    const hasAggregate = aggregateCost > 0;
    if (hasAggregate || allItemsPriced) {
      const buyingSum = hasAggregate ? aggregateCost : items.reduce((s, it) => s + toNumber(it?.buyingPrice), 0);
      supportAgg.totalProfit += sell - buyingSum;
    }
  }

  const posAgg = { totalSales: 0, count: pos.length, itemsCount: 0 };
  for (const r of pos) {
    const sell = toNumber(r.totals?.total ?? r.order?.totalAmount ?? 0);
    posAgg.totalSales += sell;
    const items = r.order?.items || [];
    posAgg.itemsCount += items.reduce((s, it) => s + (Number(it?.quantity ?? 1) || 0), 0);
  }

  console.log({ marketing: marketingAgg, support: supportAgg, pos: posAgg, missingCostsCount: missingCosts.length });
  if (missingCosts.length > 0) {
    console.log('Sample missing-cost marketing receipts (first 10):');
    console.table(missingCosts.slice(0,10));
  }

  const mk = marketing.map(r => ({ source: 'marketing', key: `marketing:${r.id}`, paymentMethod: r.paymentMethod ?? null, sellingTotal: toNumber(r.sellingTotal), items: r.items ?? [], buyingTotal: toNumber(r.buyingTotal) }));
  const sp = support.map(r => ({ source: 'support', key: `support:${r.id}`, paymentMethod: r.paymentMethod ?? null, sellingTotal: toNumber(r.sellingTotal), items: r.items ?? [], buyingTotal: toNumber(r.buyingTotal) }));
  const ps = pos.map(r => ({ source: 'pos', key: `pos:${r.id}`, paymentMethod: r.data?.paymentMethod ?? null, sellingTotal: toNumber(r.totals?.total ?? r.order?.totalAmount ?? 0), items: r.order?.items?.map(it => ({ quantity: it.quantity })) ?? [] }));

  const combined = [...mk, ...sp, ...ps];
  const priority = { pos: 3, marketing: 2, support: 1 };
  const map = new Map();
  for (const c of combined) {
    const existing = map.get(c.key);
    if (!existing || priority[c.source] > priority[existing.source]) map.set(c.key, c);
  }
  const deduped = Array.from(map.values());
  const totalSales = deduped.reduce((s, r) => s + r.sellingTotal, 0);

  let totalCost = 0, totalProfit = 0, awaitingPricing = 0;
  for (const r of deduped.filter(d => d.source !== 'pos')) {
    const items = r.items || [];
    const agg = toNumber(r.buyingTotal ?? 0);
    const allPriced = items.length > 0 && items.every(it => toNumber(it?.buyingPrice) > 0);
    const hasAgg = agg > 0;
    if (hasAgg || allPriced) {
      const buying = hasAgg ? agg : items.reduce((s, it) => s + toNumber(it?.buyingPrice), 0);
      totalCost += buying;
      totalProfit += r.sellingTotal - buying;
    } else {
      awaitingPricing += 1;
    }
  }

  const itemsCount = deduped.reduce((s, r) => s + sumItemQuantities(r.items || []), 0);
  console.log('Admin-style deduped totals:', { totalSales, totalCost, totalProfit, receiptsCount: deduped.length, itemsCount, awaitingPricing });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) { console.error('Usage: investigate-receipts-profit.cjs <fromIso> <toIso>'); process.exit(1); }
  try { await analyzeRange(args[0], args[1]); } catch (err) { console.error('Error:', err); } finally { await prisma.$disconnect(); }
}

main();
