#!/usr/bin/env node
/**
 * scripts/receipts/dedupe-delete.js
 *
 * Deletes duplicate receipts grouped by (dailyEntryId, receiptNumber, paymentMethod),
 * keeping the newest (by createdAt). Dry-run by default. Use --apply to actually
 * delete. Writes a JSON backup of deleted rows to `tmp/receipts-deleted-<ts>.json`.
 *
 * Usage:
 *   node scripts/receipts/dedupe-delete.js        # dry-run
 *   node scripts/receipts/dedupe-delete.js --apply
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function processModel(modelName, apply) {
  console.log(`\nProcessing ${modelName}...`);
  // Fetch receipts and group in JS to avoid raw SQL/table interpolation
  const rowsAll = await prisma[modelName].findMany({ where: { receiptNumber: { not: null } }, select: { id: true, dailyEntryId: true, receiptNumber: true, paymentMethod: true, sellingTotal: true, buyingTotal: true, createdAt: true } });
  const map = new Map();
  for (const r of rowsAll) {
    const rn = (r.receiptNumber || '').trim();
    if (!rn) continue;
    const key = `${r.dailyEntryId}||${rn}||${r.paymentMethod}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }

  const groups = [];
  for (const [k, arr] of map.entries()) {
    if (arr.length > 1) {
      const [dailyEntryId, receiptNumber, paymentMethod] = k.split('||');
      groups.push({ dailyEntryId, receiptNumber, paymentMethod, rows: arr });
    }
  }

  console.log(`Found ${groups.length} duplicate groups in ${modelName}`);
  const deletedRows = [];
  for (const g of groups) {
    // sort group's rows by createdAt desc, keep newest
    const rows = g.rows.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    // keep first (newest), delete rest
    const toDelete = rows.slice(1);
    for (const d of toDelete) {
      deletedRows.push({ model: modelName, id: d.id, dailyEntryId: d.dailyEntryId, receiptNumber: d.receiptNumber, paymentMethod: d.paymentMethod, sellingTotal: d.sellingTotal, buyingTotal: d.buyingTotal, createdAt: d.createdAt });
      if (apply) {
        await prisma[modelName].delete({ where: { id: d.id } });
      }
    }
  }

  return deletedRows;
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log('Starting dedupe-delete (apply=' + apply + ')');
  try {
    const deletedMarketing = await processModel('MarketingReceipt', apply);
    const deletedSupport = await processModel('SupportReceipt', apply);
    const allDeleted = [...deletedMarketing, ...deletedSupport];
    console.log(`Total to delete: ${allDeleted.length}`);
    if (allDeleted.length) {
      const outPath = path.join(process.cwd(), 'tmp', `receipts-deleted-${Date.now()}.json`);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(allDeleted, null, 2));
      console.log('Wrote backup of deleted rows to', outPath);
    }
  } catch (err) {
    console.error('Failed dedupe', err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
