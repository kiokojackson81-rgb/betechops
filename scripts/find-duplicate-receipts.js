const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

function normalize(v) {
  if (!v) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

(async () => {
  try {
    console.log('Scanning receipts for duplicate canonical keys...');
    const rows = await prisma.receipt.findMany({ select: { id: true, receiptNumber: true, createdAt: true, order: { select: { orderNumber: true } } } });
    const map = new Map();
    for (const r of rows) {
      const key = normalize(r.receiptNumber) || normalize(r.order?.orderNumber) || r.id;
      const arr = map.get(key) || [];
      arr.push({ id: r.id, receiptNumber: r.receiptNumber, orderNumber: r.order?.orderNumber, createdAt: r.createdAt });
      map.set(key, arr);
    }

    const duplicates = [];
    for (const [key, items] of map.entries()) {
      if (items.length > 1) {
        duplicates.push({ key, count: items.length, items });
      }
    }

    console.log(`Found ${duplicates.length} duplicate keys`);
    const out = { generatedAt: new Date().toISOString(), duplicates };
    fs.writeFileSync('duplicate-receipts-report.json', JSON.stringify(out, null, 2));
    console.log('Wrote duplicate-receipts-report.json');
    if (duplicates.length > 0) {
      console.warn('Duplicates detected — please inspect duplicate-receipts-report.json');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // fetch marketing and support receipts
  const [marketing, support] = await Promise.all([
    prisma.marketingReceipt.findMany({ select: { id: true, receiptNumber: true, receiptKey: true, sellingTotal: true, paymentMethod: true, createdAt: true, dailyEntryId: true } }),
    prisma.supportReceipt.findMany({ select: { id: true, receiptNumber: true, receiptKey: true, sellingTotal: true, paymentMethod: true, createdAt: true, dailyEntryId: true } }),
  ]);

  const map = new Map();
  function add(row, source) {
    const key = String(row.receiptKey ?? row.receiptNumber ?? `ID:${row.id}`);
    const entry = map.get(key) ?? { key, sources: new Set(), rows: [] };
    entry.sources.add(source);
    entry.rows.push({ source, id: row.id, receiptNumber: row.receiptNumber, receiptKey: row.receiptKey, sellingTotal: row.sellingTotal, paymentMethod: row.paymentMethod, createdAt: row.createdAt, dailyEntryId: row.dailyEntryId });
    map.set(key, entry);
  }

  for (const r of marketing) add(r, 'marketing');
  for (const r of support) add(r, 'support');

  // optionally try to include POS orders if model exists
  try {
    if (typeof prisma.order !== 'undefined') {
      const orders = await prisma.order.findMany({ select: { id: true, orderNumber: true, createdAt: true, attendantId: true } });
      for (const o of orders) {
        const k = String(o.orderNumber ?? o.id);
        const entry = map.get(k) ?? { key: k, sources: new Set(), rows: [] };
        entry.sources.add('pos');
        entry.rows.push({ source: 'pos', id: o.id, receiptNumber: o.orderNumber, receiptKey: o.orderNumber, sellingTotal: null, paymentMethod: null, createdAt: o.createdAt, dailyEntryId: null, attendantId: o.attendantId });
        map.set(k, entry);
      }
    }
  } catch (err) {
    // ignore
  }

  const duplicates = Array.from(map.values()).filter(e => e.sources.size > 1);
  console.log('Found', duplicates.length, 'receiptKeys with multiple sources');
  const sample = duplicates.slice(0, 50);
  for (const d of sample) {
    console.log('---');
    console.log('key:', d.key, 'sources:', Array.from(d.sources).join(','));
    for (const r of d.rows.slice(0, 10)) {
      console.log(' ', r);
    }
  }

  await prisma.$disconnect();
}

main().catch(err=>{ console.error(err); process.exit(1); });
