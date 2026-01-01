#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

function normalizeKey(v) {
  if (!v) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

(async function main() {
  try {
    console.log('Scanning receipts, marketing receipts, support receipts, and orders for duplicate keys...');

    const [receipts, marketing, support] = await Promise.all([
      prisma.receipt.findMany({ select: { id: true, receiptNumber: true, createdAt: true, order: { select: { orderNumber: true } } } }),
      prisma.marketingReceipt.findMany({ select: { id: true, receiptNumber: true, receiptKey: true, sellingTotal: true, paymentMethod: true, createdAt: true, dailyEntryId: true } }),
      prisma.supportReceipt.findMany({ select: { id: true, receiptNumber: true, receiptKey: true, sellingTotal: true, paymentMethod: true, createdAt: true, dailyEntryId: true } }),
    ]);

    const map = new Map();

    function addToMap(key, row, source) {
      const entry = map.get(key) || { key, sources: new Set(), rows: [] };
      entry.sources.add(source);
      entry.rows.push(Object.assign({ source }, row));
      map.set(key, entry);
    }

    for (const r of receipts) {
      const key = normalizeKey(r.receiptNumber) || normalizeKey(r.order?.orderNumber) || `ID:${r.id}`;
      addToMap(key, { id: r.id, receiptNumber: r.receiptNumber, orderNumber: r.order?.orderNumber, createdAt: r.createdAt, attendantId: r.attendantId }, 'receipt');
    }

    for (const r of marketing) {
      const key = normalizeKey(r.receiptKey) || normalizeKey(r.receiptNumber) || `ID:${r.id}`;
      addToMap(key, { id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, sellingTotal: r.sellingTotal, paymentMethod: r.paymentMethod, createdAt: r.createdAt, dailyEntryId: r.dailyEntryId }, 'marketing');
    }

    for (const r of support) {
      const key = normalizeKey(r.receiptKey) || normalizeKey(r.receiptNumber) || `ID:${r.id}`;
      addToMap(key, { id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, sellingTotal: r.sellingTotal, paymentMethod: r.paymentMethod, createdAt: r.createdAt, dailyEntryId: r.dailyEntryId }, 'support');
    }

    // Optionally include POS orders if model exists
    try {
      if (prisma.order) {
        const orders = await prisma.order.findMany({ select: { id: true, orderNumber: true, createdAt: true } });
        for (const o of orders) {
          const key = normalizeKey(o.orderNumber) || `ID:${o.id}`;
          addToMap(key, { id: o.id, orderNumber: o.orderNumber, createdAt: o.createdAt }, 'order');
        }
      }
    } catch (err) {
      // ignore if order model not available
    }

    const duplicates = [];
    for (const [k, entry] of map.entries()) {
      if (entry.rows.length > 1 || entry.sources.size > 1) {
        duplicates.push({ key: k, sources: Array.from(entry.sources), count: entry.rows.length, rows: entry.rows });
      }
    }

    const out = { generatedAt: new Date().toISOString(), totalKeys: map.size, duplicateCount: duplicates.length, duplicates };
    fs.writeFileSync('duplicate-receipts-report.json', JSON.stringify(out, null, 2));
    console.log(`Wrote duplicate-receipts-report.json — found ${duplicates.length} duplicate keys.`);
    if (duplicates.length > 0) console.warn('Duplicates detected — inspect duplicate-receipts-report.json');
  } catch (e) {
    console.error('Error scanning duplicates:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
