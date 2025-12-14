#!/usr/bin/env node
/*
  Safe script to identify receipts with missing or non-positive buying prices
  and recompute their parent daily entry totals so profit from incomplete receipts
  is not counted.

  Usage (dry-run):
    DATABASE_URL="postgresql://..." node scripts/patch_missing_receipt_costs.js --dry-run

  Usage (apply):
    DATABASE_URL="postgresql://..." node scripts/patch_missing_receipt_costs.js

  The script updates `marketingDailyEntry.totalSales`, `marketingDailyEntry.totalProfit`
  and `supportDailyEntry.totalSales`, `supportDailyEntry.totalProfit` for affected entries.
*/

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run") || argv.includes("-n");

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function recomputeMarketingEntry(entryId) {
  const entry = await prisma.marketingDailyEntry.findUnique({
    where: { id: entryId },
    include: { receipts: { include: { items: true } } },
  });
  if (!entry) return null;
  const totalSales = entry.receipts.reduce((s, r) => s + toNumber(r.sellingTotal), 0);
  const totalProfit = entry.receipts.reduce((sum, r) => {
    const items = r.items || [];
    const fallbackCost = items.reduce((s, it) => s + toNumber(it.buyingPrice), 0);
    const aggregateCost = toNumber(r.buyingTotal);
    const hasAggregateCost = aggregateCost > 0;
    const allItemsPriced = items.length > 0 && items.every((it) => toNumber(it.buyingPrice) > 0);
    if (hasAggregateCost || allItemsPriced) {
      const buyingSum = hasAggregateCost ? aggregateCost : fallbackCost;
      return sum + (toNumber(r.sellingTotal) - buyingSum);
    }
    return sum;
  }, 0);
  if (dryRun) {
    return { entryId, totalSales, totalProfit };
  }
  await prisma.marketingDailyEntry.update({ where: { id: entryId }, data: { totalSales, totalProfit } });
  return { entryId, totalSales, totalProfit };
}

async function recomputeSupportEntry(entryId) {
  const receipts = await prisma.supportReceipt.findMany({ where: { dailyEntryId: entryId }, include: { items: true } });
  const totalSales = receipts.reduce((s, r) => s + toNumber(r.sellingTotal), 0);
  const totalProfit = receipts.reduce((sum, r) => {
    const items = r.items || [];
    const fallbackCost = items.reduce((s, it) => s + toNumber(it.buyingPrice), 0);
    const aggregateCost = toNumber(r.buyingTotal);
    const hasAggregateCost = aggregateCost > 0;
    const allItemsPriced = items.length > 0 && items.every((it) => toNumber(it.buyingPrice) > 0);
    if (hasAggregateCost || allItemsPriced) {
      const buyingSum = hasAggregateCost ? aggregateCost : fallbackCost;
      return sum + (toNumber(r.sellingTotal) - buyingSum);
    }
    return sum;
  }, 0);
  if (dryRun) {
    return { entryId, totalSales, totalProfit };
  }
  await prisma.supportDailyEntry.update({ where: { id: entryId }, data: { totalSales, totalProfit } });
  return { entryId, totalSales, totalProfit };
}

async function main() {
  console.log(`Running patch_missing_receipt_costs ${dryRun ? "(dry-run)" : "(apply)"}`);

  // Find marketing receipts with incomplete costs
  const marketingReceipts = await prisma.marketingReceipt.findMany({ include: { items: true } });
  const affectedMarketingEntryIds = new Set();
  for (const r of marketingReceipts) {
    const items = r.items || [];
    const aggregateCost = toNumber(r.buyingTotal);
    const allItemsPriced = items.length > 0 && items.every((it) => toNumber(it.buyingPrice) > 0);
    if (!(aggregateCost > 0 || allItemsPriced)) {
      if (r.dailyEntryId) affectedMarketingEntryIds.add(r.dailyEntryId);
    }
  }

  // Find support receipts with incomplete costs
  const supportReceipts = await prisma.supportReceipt.findMany({ include: { items: true } });
  const affectedSupportEntryIds = new Set();
  for (const r of supportReceipts) {
    const items = r.items || [];
    const aggregateCost = toNumber(r.buyingTotal);
    const allItemsPriced = items.length > 0 && items.every((it) => toNumber(it.buyingPrice) > 0);
    if (!(aggregateCost > 0 || allItemsPriced)) {
      if (r.dailyEntryId) affectedSupportEntryIds.add(r.dailyEntryId);
    }
  }

  const results = [];
  for (const entryId of affectedMarketingEntryIds) {
    const res = await recomputeMarketingEntry(entryId);
    results.push({ type: "marketing", ...res });
  }
  for (const entryId of affectedSupportEntryIds) {
    const res = await recomputeSupportEntry(entryId);
    results.push({ type: "support", ...res });
  }

  if (dryRun) {
    console.log("Dry-run results (no DB changes):");
    console.table(results.map((r) => ({ type: r.type, entryId: r.entryId, totalSales: r.totalSales, totalProfit: r.totalProfit })));
  } else {
    console.log("Updated entries:");
    console.table(results.map((r) => ({ type: r.type, entryId: r.entryId, totalSales: r.totalSales, totalProfit: r.totalProfit })));
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect().finally(() => process.exit(1));
});
