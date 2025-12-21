#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['warn','error'] });
function toNumber(v){return Number(v ?? 0) || 0}
function computeReceiptProfit(rec){
  const sell = toNumber(rec.sellingTotal ?? rec.totals?.total ?? rec.order?.totalAmount ?? 0);
  const items = rec.items || rec.order?.items || [];
  const aggregate = toNumber(rec.buyingTotal ?? 0);
  const itemsArr = Array.isArray(items) ? items : [];
  const allPriced = itemsArr.length > 0 && itemsArr.every(it => toNumber(it?.buyingPrice) > 0);
  if (aggregate > 0 || allPriced) {
    const buying = aggregate > 0 ? aggregate : itemsArr.reduce((s,it)=>s+toNumber(it?.buyingPrice),0);
    return { profit: sell - buying, buying };
  }
  return { profit: null, buying: 0 };
}
async function main(){
  const from = new Date('2025-12-17T00:00:00.000Z');
  const to = new Date('2025-12-17T23:59:59.999Z');
  const marketing = await prisma.marketingReceipt.findMany({ where: { dailyEntry: { date: { gte: from, lte: to } } }, include: { items: true }, orderBy: { id: 'asc' } });
  const support = await prisma.supportReceipt.findMany({ where: { dailyEntry: { date: { gte: from, lte: to } } }, include: { items: true }, orderBy: { id: 'asc' } });
  const pos = await prisma.receipt.findMany({ where: { generatedAt: { gte: from, lte: to } }, include: { order: { include: { items: true } } }, orderBy: { id: 'asc' } });

  const rows = [];
  for (const r of marketing) {
    const { profit, buying } = computeReceiptProfit({ ...r, items: r.items });
    rows.push({ source: 'marketing', id: r.id, receiptNumber: r.receiptNumber ?? null, sellingTotal: toNumber(r.sellingTotal), buyingTotal: buying, profit, awaitingPricing: profit===null });
  }
  for (const r of support) {
    const { profit, buying } = computeReceiptProfit({ ...r, items: r.items });
    rows.push({ source: 'support', id: r.id, receiptNumber: r.receiptNumber ?? null, sellingTotal: toNumber(r.sellingTotal), buyingTotal: buying, profit, awaitingPricing: profit===null });
  }
  for (const r of pos) {
    const { profit, buying } = computeReceiptProfit({ ...r, order: r.order, totals: r.totals });
    rows.push({ source: 'pos', id: r.id, orderNumber: r.order?.orderNumber ?? null, sellingTotal: toNumber(r.totals?.total ?? r.order?.totalAmount), buyingTotal: buying, profit, awaitingPricing: profit===null });
  }

  console.log('\nPer-receipt profit details for 2025-12-17:');
  console.table(rows.map(x=>({source:x.source,id:x.id,receipt:x.receiptNumber||x.orderNumber||'',sellingTotal:x.sellingTotal,buyingTotal:x.buyingTotal,profit:x.profit,awaitingPricing:x.awaitingPricing})));

  const sumProfit = rows.reduce((s,r)=>s + (r.profit==null?0:r.profit), 0);
  const sumAwait = rows.filter(r=>r.awaitingPricing).length;
  console.log('\nSummed profit (treat missing as 0):', sumProfit);
  console.log('Receipts awaiting pricing:', sumAwait);
  await prisma.$disconnect();
}
main().catch(e=>{console.error(e); prisma.$disconnect().finally(()=>process.exit(1))});
