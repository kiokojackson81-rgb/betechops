#!/usr/bin/env node
/**
 * scripts/receipts/log-offending-keys.js
 *
 * Logs duplicate receipt groups that would violate the upcoming unique
 * constraints: (dailyEntryId, receiptNumber, paymentMethod) and
 * receiptKey (YYYY-MM-DD + canonical receiptNumber).
 *
 * Usage:
 *   node scripts/receipts/log-offending-keys.js
 */

const { PrismaClient } = require('@prisma/client');

// Lightweight canonicalizer (mirrors src/lib/receipts/utils.ts behaviour)
function canonicalReceiptNumber(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.replace(/\s|-/g, '').toUpperCase();
}
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function findDuplicates(modelName) {
  const model = prisma[modelName];
  if (!model) throw new Error(`Model ${modelName} not found on prisma client`);

  // fetch minimal rows and group in JS to avoid raw SQL interpolation issues
  const rows = await model.findMany({ where: { receiptNumber: { not: null } }, select: { dailyEntryId: true, receiptNumber: true, paymentMethod: true } });
  const map = new Map();
  for (const r of rows) {
    const rn = (r.receiptNumber || '').trim();
    if (!rn) continue;
    const key = `${r.dailyEntryId}||${rn}||${r.paymentMethod}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  const result = [];
  for (const [k, cnt] of map.entries()) {
    if (cnt > 1) {
      const [dailyEntryId, receiptNumber, paymentMethod] = k.split('||');
      result.push({ dailyEntryId, receiptNumber, paymentMethod, cnt });
    }
  }
  // sort by cnt desc
  result.sort((a, b) => b.cnt - a.cnt);
  return result;
}

async function findReceiptKeyConflicts(modelName) {
  // load receipts and compute receiptKey = YYYY-MM-DD + '_' + canonical
  const rows = await prisma[modelName].findMany({ where: { receiptNumber: { not: null } }, select: { id: true, receiptNumber: true, dailyEntryId: true, paymentMethod: true, createdAt: true, updatedAt: true } });
  const map = new Map();
  for (const r of rows) {
    const rn = canonicalReceiptNumber(r.receiptNumber);
    const entry = await prisma[modelName.replace('Receipt','DailyEntry')].findUnique({ where: { id: r.dailyEntryId }, select: { date: true } }).catch(()=>null);
    const date = entry && entry.date ? new Date(entry.date).toISOString().slice(0,10) : 'unknown';
    const key = `${date}_${rn}_${r.paymentMethod}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  const conflicts = [];
  for (const [k, arr] of map.entries()) {
    if (arr.length > 1) conflicts.push({ key: k, count: arr.length, ids: arr.map(x=>x.id) });
  }
  return conflicts;
}

async function main() {
  console.log('Scanning for duplicate receipt groups (dailyEntryId, receiptNumber, paymentMethod)...');
  const marketingDup = await findDuplicates('MarketingReceipt');
  const supportDup = await findDuplicates('SupportReceipt');

  console.log('\nMarketing duplicates by (dailyEntryId, receiptNumber, paymentMethod):');
  console.table(marketingDup.map(r => ({ dailyEntryId: r.dailyEntryId, receiptNumber: r.receiptNumber, paymentMethod: r.paymentMethod, count: Number(r.cnt) })));

  console.log('\nSupport duplicates by (dailyEntryId, receiptNumber, paymentMethod):');
  console.table(supportDup.map(r => ({ dailyEntryId: r.dailyEntryId, receiptNumber: r.receiptNumber, paymentMethod: r.paymentMethod, count: Number(r.cnt) })));

  console.log('\nScanning for receiptKey conflicts (date + canonicalSerial + method)...');
  const mConflicts = await findReceiptKeyConflicts('MarketingReceipt');
  const sConflicts = await findReceiptKeyConflicts('SupportReceipt');

  console.log('\nMarketing receiptKey conflicts: ' + mConflicts.length);
  console.log('\nSupport receiptKey conflicts: ' + sConflicts.length);

  const out = { marketingDuplicates: marketingDup, supportDuplicates: supportDup, marketingKeyConflicts: mConflicts, supportKeyConflicts: sConflicts };
  const outPath = path.join(process.cwd(), 'tmp', `receipt-duplicates-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('Written report to', outPath);

  await prisma.$disconnect();
}

main().catch(err=>{ console.error(err); process.exitCode=2; });
