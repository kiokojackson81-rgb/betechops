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

async function inspect(receipt) {
  const key = buildReceiptKey(receipt);
  console.log('---');
  console.log('input:', receipt);
  console.log('receiptKey:', key);
  if (!key) return;
  try {
    const marketing = await prisma.marketingReceipt.findMany({ where: { OR: [{ receiptKey: key }, { receiptNumber: key }] }, include: { dailyEntry: true } });
    const support = await prisma.supportReceipt.findMany({ where: { OR: [{ receiptKey: key }, { receiptNumber: key }] }, include: { dailyEntry: true } });
    console.log('marketing rows:', marketing.length);
    marketing.slice(0,5).forEach(r=>console.log({ id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, sellingTotal: r.sellingTotal, paymentMethod: r.paymentMethod, createdAt: r.createdAt, submittedById: r.dailyEntry?.submittedById ?? null }));
    console.log('support rows:', support.length);
    support.slice(0,5).forEach(r=>console.log({ id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, sellingTotal: r.sellingTotal, paymentMethod: r.paymentMethod, createdAt: r.createdAt, submittedById: r.dailyEntry?.submittedById ?? null }));
  } catch (err) {
    console.error('db error', String(err));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const samples = args.length ? args : [
    'Betech-20251228-80219',
    'Betech-20251228-25252',
  ];
  for (const s of samples) {
    await inspect(s);
  }
  await prisma.$disconnect();
}

main().catch(err=>{ console.error(err); process.exit(1); });
