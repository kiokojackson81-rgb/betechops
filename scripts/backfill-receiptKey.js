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

function buildReceiptKey(rawReceiptNumber, fallbackId) {
  const n = normalizeReceiptNumber(rawReceiptNumber);
  if (n && n.length > 0) return n;
  if (fallbackId) return `ID:${String(fallbackId)}`;
  return '';
}

async function processModel(prop, modelName, limit) {
  console.log(`\nProcessing ${modelName}`);
  const where = { receiptKey: null };
  const rows = await prisma[prop].findMany({ where, select: { id: true, receiptNumber: true, paymentMethod: true }, take: limit });
  console.log(`Found ${rows.length} rows without receiptKey`);

  const updates = [];
  const conflicts = [];
  const seen = new Map();

  for (const r of rows) {
    const key = buildReceiptKey(r.receiptNumber ?? null, r.id);
    if (!key) continue;
    const prev = seen.get(key);
    if (prev && prev !== r.id) {
      conflicts.push({ id: r.id, key, conflictWithId: prev });
      continue;
    }
    const existing = await prisma[prop].findFirst({ where: { receiptKey: key }, select: { id: true } });
    if (existing && existing.id !== r.id) {
      conflicts.push({ id: r.id, key, conflictWithId: existing.id });
      continue;
    }
    seen.set(key, r.id);
    updates.push({ id: r.id, key });
  }

  console.log(`Prepared ${updates.length} updates, ${conflicts.length} conflicts`);
  if (conflicts.length) console.log('Sample conflicts:', conflicts.slice(0, 10));
  if (updates.length) console.log('Sample updates:', updates.slice(0, 10));
  return { updates, conflicts };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

  console.log(`Mode=${apply ? 'APPLY' : 'DRY-RUN'} limit=${limit ?? 'ALL'}`);

  const models = [
    { prop: 'marketingReceipt', name: 'MarketingReceipt' },
    { prop: 'supportReceipt', name: 'SupportReceipt' },
  ];

  for (const m of models) {
    const { updates, conflicts } = await processModel(m.prop, m.name, limit);
    if (!apply) continue;
    if (conflicts.length) {
      console.error('Aborting apply due to conflicts for', m.name);
      process.exitCode = 2;
      return;
    }
    if (updates.length) {
      for (const u of updates) {
        await prisma[m.prop].update({ where: { id: u.id }, data: { receiptKey: u.key } });
      }
      console.log(`Applied ${updates.length} updates to ${m.name}`);
    }
  }

  console.log('Done');
}

main().catch(err => { console.error(err); process.exit(1); });
