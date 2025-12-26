#!/usr/bin/env node
/**
 * scripts/receipts/recompute-totals.js
 *
 * Recompute `totalSales` and `totalProfit` for MarketingDailyEntry and
 * SupportDailyEntry from their receipts. By default runs in dry-run mode
 * and prints proposed changes. Pass `--apply` to perform updates.
 *
 * Usage:
 *   node scripts/receipts/recompute-totals.js        # dry-run
 *   node scripts/receipts/recompute-totals.js --apply
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function recomputeMarketing(apply) {
  console.log('Recomputing MarketingDailyEntry totals...');
  const entries = await prisma.marketingDailyEntry.findMany({ select: { id: true, totalSales: true, totalProfit: true } });
  let changed = 0;
  for (const e of entries) {
    const agg = await prisma.marketingReceipt.aggregate({ where: { dailyEntryId: e.id }, _sum: { sellingTotal: true, buyingTotal: true } });
    const sumSelling = Number(agg._sum.sellingTotal ?? 0);
    const sumBuying = Number(agg._sum.buyingTotal ?? 0);
    const profit = sumSelling - sumBuying;
    if (e.totalSales !== sumSelling || e.totalProfit !== profit) {
      changed++;
      console.log(`marketingEntry=${e.id} before: sales=${e.totalSales} profit=${e.totalProfit} -> computed: sales=${sumSelling} profit=${profit}`);
      if (apply) {
        await prisma.marketingDailyEntry.update({ where: { id: e.id }, data: { totalSales: sumSelling, totalProfit: profit } });
      }
    }
  }
  console.log(`Marketing entries checked: ${entries.length}, to update: ${changed}`);
}

async function recomputeSupport(apply) {
  console.log('Recomputing SupportDailyEntry totals...');
  const entries = await prisma.supportDailyEntry.findMany({ select: { id: true, totalSales: true, totalProfit: true } });
  let changed = 0;
  for (const e of entries) {
    const agg = await prisma.supportReceipt.aggregate({ where: { dailyEntryId: e.id }, _sum: { sellingTotal: true, buyingTotal: true } });
    const sumSelling = Number(agg._sum.sellingTotal ?? 0);
    const sumBuying = Number(agg._sum.buyingTotal ?? 0);
    const profit = sumSelling - sumBuying;
    if (e.totalSales !== sumSelling || e.totalProfit !== profit) {
      changed++;
      console.log(`supportEntry=${e.id} before: sales=${e.totalSales} profit=${e.totalProfit} -> computed: sales=${sumSelling} profit=${profit}`);
      if (apply) {
        await prisma.supportDailyEntry.update({ where: { id: e.id }, data: { totalSales: sumSelling, totalProfit: profit } });
      }
    }
  }
  console.log(`Support entries checked: ${entries.length}, to update: ${changed}`);
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`Starting recompute-totals (apply=${apply})`);
  try {
    await recomputeMarketing(apply);
    await recomputeSupport(apply);
    console.log('Done.');
  } catch (err) {
    console.error('Failed to recompute totals', err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
