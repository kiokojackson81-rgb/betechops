#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getTradingPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year;
    startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear();
    endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear();
    startMonth = prev.getMonth();
    endYear = year;
    endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
  return { start, end };
}

function normalizeReceiptNumber(input) {
  if (input == null) return '';
  const s = String(input);
  const trimmed = s.trim();
  if (!trimmed) return '';
  let out = trimmed.toUpperCase().replace(/[\s\-_]+/g, '');
  out = out.replace(/[^A-Z0-9]/g, '');
  return out;
}

function buildReceiptKey(raw, fallback) {
  const n = normalizeReceiptNumber(raw);
  if (n) return n;
  if (fallback) return `ID:${String(fallback)}`;
  return '';
}

async function run(attendantId, dateArg) {
  const date = dateArg ? new Date(dateArg) : new Date();
  const period = getTradingPeriodFor(date);
  console.log('Querying attendant:', attendantId);
  console.log('Period:', period.start.toISOString(), '->', period.end.toISOString());

  // fetch user email/name to match legacy rows attributed by email/name
  const user = await prisma.user.findUnique({ where: { id: attendantId }, select: { id: true, email: true, name: true } });
  const userEmail = user?.email ? String(user.email).toLowerCase() : null;
  const userName = user?.name ? String(user.name) : null;

  // Marketing receipts where the daily entry was submitted by attendant (id OR email OR name)
  const marketing = await prisma.marketingReceipt.findMany({
    where: {
      createdAt: { gte: period.start, lte: period.end },
      OR: [
        { dailyEntry: { submittedById: attendantId } },
        ...(userEmail ? [{ dailyEntry: { submittedByEmail: userEmail } }] : []),
        ...(userName ? [{ dailyEntry: { submittedByName: userName } }] : []),
      ],
    },
    select: { id: true, receiptNumber: true, receiptKey: true, sellingTotal: true, buyingTotal: true, paymentMethod: true, createdAt: true },
  });

  // Support receipts where the daily entry was submitted by attendant (id OR email OR name)
  const support = await prisma.supportReceipt.findMany({
    where: {
      createdAt: { gte: period.start, lte: period.end },
      OR: [
        { dailyEntry: { submittedById: attendantId } },
        ...(userEmail ? [{ dailyEntry: { submittedByEmail: userEmail } }] : []),
        ...(userName ? [{ dailyEntry: { submittedByName: userName } }] : []),
      ],
    },
    select: { id: true, receiptNumber: true, receiptKey: true, sellingTotal: true, buyingTotal: true, paymentMethod: true, createdAt: true },
  });

  // POS receipts where attendant issued the receipt
  const pos = await prisma.receipt.findMany({
    where: {
      createdAt: { gte: period.start, lte: period.end },
      issuedById: attendantId,
    },
    select: { id: true, orderId: true, data: true, totals: true, createdAt: true, issuedById: true },
  });

  const rows = [];

  for (const r of marketing) {
    const key = String(r.receiptKey ?? buildReceiptKey(r.receiptNumber ?? null, r.id));
    rows.push({ source: 'MARKETING', id: r.id, receiptNumber: r.receiptNumber || null, receiptKey: key, sales: r.sellingTotal || 0, profit: Math.max(0, (r.sellingTotal || 0) - (r.buyingTotal || 0)), paymentMethod: r.paymentMethod || null, createdAt: r.createdAt });
  }
  for (const r of support) {
    const key = String(r.receiptKey ?? buildReceiptKey(r.receiptNumber ?? null, r.id));
    rows.push({ source: 'SUPPORT', id: r.id, receiptNumber: r.receiptNumber || null, receiptKey: key, sales: r.sellingTotal || 0, profit: Math.max(0, (r.sellingTotal || 0) - (r.buyingTotal || 0)), paymentMethod: r.paymentMethod || null, createdAt: r.createdAt });
  }
  for (const r of pos) {
    let receiptNumber = null;
    try { receiptNumber = (r.data && r.data.receiptNumber) ? r.data.receiptNumber : null; } catch(e) { receiptNumber = null; }
    const key = buildReceiptKey(receiptNumber, r.orderId || r.id);
    let sales = 0;
    try { if (r.totals && r.totals.total) sales = Number(r.totals.total); } catch(e) { sales = 0; }
    rows.push({ source: 'POS', id: r.id, receiptNumber, receiptKey: key, sales, profit: null, paymentMethod: (r.data && r.data.paymentMethod) ? r.data.paymentMethod : null, createdAt: r.createdAt });
  }

  rows.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  console.table(rows.map(r => ({ source: r.source, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, sales: r.sales, profit: r.profit, paymentMethod: r.paymentMethod, createdAt: r.createdAt })), ['source','receiptNumber','receiptKey','sales','profit','paymentMethod','createdAt']);

  // show counts and note if any receipts exist where attendant didn't create (i.e., no rows)
  console.log('\nTotals: marketing', marketing.length, 'support', support.length, 'pos', pos.length, 'combined', rows.length);

  await prisma.$disconnect();
}

const id = process.argv[2];
const dateArg = process.argv[3];
if (!id) {
  console.error('Usage: node scripts/list-attendant-receipts.js <ATTENDANT_ID> [YYYY-MM-DD]');
  process.exit(2);
}
run(id, dateArg).catch(e => { console.error(e); process.exit(1); });
