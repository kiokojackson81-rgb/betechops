#!/usr/bin/env node
/**
 * scripts/receipts/dedupe-merge.js
 *
 * Merge conflicting receipts that share the same receiptKey (date + canonical serial + paymentMethod).
 * For each conflict group: keep the newest receipt (by createdAt) and merge items and totals
 * from older receipts into the keeper, then delete the older receipts. Dry-run by default.
 *
 * Usage:
 *   node scripts/receipts/dedupe-merge.js          # dry-run
 *   node scripts/receipts/dedupe-merge.js --apply  # perform changes
 *   node scripts/receipts/dedupe-merge.js --apply --recompute  # apply and recompute affected entries
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

function canonicalReceiptNumber(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.replace(/\s|-/g, '').toUpperCase();
}

async function findKeyGroups(modelName) {
  const rows = await prisma[modelName].findMany({
    where: { receiptNumber: { not: null } },
    select: {
      id: true,
      receiptNumber: true,
      dailyEntryId: true,
      paymentMethod: true,
      createdAt: true,
      sellingTotal: true,
      buyingTotal: true,
      items: { select: { id: true, productName: true, buyingPrice: true } },
      dailyEntry: { select: { date: true } },
    },
  });

  const map = new Map();
  for (const r of rows) {
    const rn = canonicalReceiptNumber(r.receiptNumber);
    const date = r.dailyEntry?.date ? new Date(r.dailyEntry.date).toISOString().slice(0, 10) : 'unknown';
    const pm = r.paymentMethod || 'MPESA';
    const key = `${date}_${rn}_${pm}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }

  const conflicts = [];
  for (const [key, arr] of map.entries()) {
    if (arr.length > 1) conflicts.push({ key, receipts: arr });
  }
  return conflicts;
}

async function mergeGroupsForModel(modelName, apply, recomputePlan) {
  const conflicts = await findKeyGroups(modelName);
  const plan = [];
  for (const g of conflicts) {
    // pick keeper: newest by createdAt
    const sorted = g.receipts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const keeper = sorted[0];
    const others = sorted.slice(1);
    const ops = [];
    for (const src of others) {
      ops.push({ srcId: src.id, keeperId: keeper.id, srcSelling: src.sellingTotal, srcBuying: src.buyingTotal, srcItems: src.items.map(i => ({ productName: i.productName, buyingPrice: i.buyingPrice })) });
    }
    plan.push({ key: g.key, keeperId: keeper.id, keeperCreatedAt: keeper.createdAt, ops });
  }

  if (!plan.length) return { plan: [], executed: [] };

  const executed = [];
  for (const p of plan) {
    for (const op of p.ops) {
      executed.push({ model: modelName, key: p.key, keeperId: p.keeperId, srcId: op.srcId, srcSelling: op.srcSelling, srcBuying: op.srcBuying, srcItemsCount: op.srcItems.length, applied: false });
    }
  }

  if (!apply) {
    return { plan, executed: [] };
  }

  // Apply merges
  for (const p of plan) {
    const keeper = await prisma[modelName].findUnique({ where: { id: p.keeperId }, include: { items: true } });
    if (!keeper) continue;
    let newSelling = Number(keeper.sellingTotal || 0);
    let newBuying = Number(keeper.buyingTotal || 0);
    for (const op of p.ops) {
      const src = await prisma[modelName].findUnique({ where: { id: op.srcId }, include: { items: true } });
      if (!src) continue;
      // copy items
      for (const it of src.items || []) {
        await prisma[modelName + 'Item'].create({ data: { receiptId: keeper.id, productName: it.productName, buyingPrice: it.buyingPrice } });
      }
      newSelling += Number(src.sellingTotal || 0);
      newBuying += Number(src.buyingTotal || 0);
      // delete source items then source
      await prisma[modelName + 'Item'].deleteMany({ where: { receiptId: src.id } });
      await prisma[modelName].delete({ where: { id: src.id } });
    }
    // update keeper totals
    await prisma[modelName].update({ where: { id: keeper.id }, data: { sellingTotal: newSelling, buyingTotal: newBuying } });
  }

  // recompute totals for affected entries if requested
  const affectedEntryIds = new Set();
  if (recomputePlan) {
    // gather affected dailyEntryIds from all receipts of both models
    const affectedReceipts = await prisma[modelName].findMany({ where: { id: { in: plan.flatMap(p => [p.keeperId]) } }, select: { dailyEntryId: true } });
    for (const r of affectedReceipts) affectedEntryIds.add(r.dailyEntryId);
    // recompute aggregated totals for these entries
    for (const entryId of affectedEntryIds) {
      if (modelName === 'MarketingReceipt') {
        const agg = await prisma.marketingReceipt.aggregate({ where: { dailyEntryId: entryId }, _sum: { sellingTotal: true, buyingTotal: true } });
        const sumSelling = Number(agg._sum.sellingTotal ?? 0);
        const sumBuying = Number(agg._sum.buyingTotal ?? 0);
        await prisma.marketingDailyEntry.update({ where: { id: entryId }, data: { totalSales: sumSelling, totalProfit: sumSelling - sumBuying } });
      } else if (modelName === 'SupportReceipt') {
        const agg = await prisma.supportReceipt.aggregate({ where: { dailyEntryId: entryId }, _sum: { sellingTotal: true, buyingTotal: true } });
        const sumSelling = Number(agg._sum.sellingTotal ?? 0);
        const sumBuying = Number(agg._sum.buyingTotal ?? 0);
        await prisma.supportDailyEntry.update({ where: { id: entryId }, data: { totalSales: sumSelling, totalProfit: sumSelling - sumBuying } });
      }
    }
  }

  return { plan, executed: [] };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const recompute = process.argv.includes('--recompute');
  console.log(`Starting dedupe-merge (apply=${apply}, recompute=${recompute})`);
  try {
    const m = await mergeGroupsForModel('MarketingReceipt', apply, recompute);
    const s = await mergeGroupsForModel('SupportReceipt', apply, recompute);
    const out = { marketing: m.plan, support: s.plan };
    const outPath = path.join(process.cwd(), 'tmp', `receipts-merge-plan-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log('Wrote merge plan to', outPath);
    if (!apply) console.log('Dry-run complete. No changes applied. Rerun with --apply to perform merges.');
  } catch (err) {
    console.error('Failed merge', err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
