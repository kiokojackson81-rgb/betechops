const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2] || 'Betech-20260130-58585';
  const orderNumber = arg;
  console.log('Checking aggregates for', orderNumber);

  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) {
    console.log('Order not found by orderNumber, trying receipt id');
  } else {
    console.log('Order found:', { id: order.id, status: order.status, paymentStatus: order.paymentStatus, attendantId: order.attendantId, totalAmount: order.totalAmount });
  }

  // Find receipt by orderId or by id
  let receipt = null;
  if (order) receipt = await prisma.receipt.findFirst({ where: { orderId: order.id }, include: { order: true } });
  if (!receipt) {
    receipt = await prisma.receipt.findUnique({ where: { id: orderNumber }, include: { order: true } }).catch(() => null);
  }
  if (!receipt) {
    console.log('Receipt not found for', orderNumber);
    await prisma.$disconnect();
    return;
  }

  console.log('Receipt:', { id: receipt.id, generatedAt: receipt.generatedAt, docType: receipt.docType });
  console.log('Receipt.data.podDelivery:', (receipt.data && receipt.data.podDelivery) || null);

  const attendantId = order?.attendantId || (receipt.data && receipt.data.attendantId) || null;
  console.log('AttendantId:', attendantId);

  // Check MarketingReceipt table for matching receiptNumber
  const mkMatches = await prisma.marketingReceipt.findMany({ where: { OR: [{ receiptNumber: orderNumber }, { receiptKey: orderNumber }] }, include: { dailyEntry: true } });
  console.log('MarketingReceipt matches:', mkMatches.length);
  mkMatches.forEach((r) => console.log({ id: r.id, dailyEntryId: r.dailyEntryId, receiptNumber: r.receiptNumber, sellingTotal: r.sellingTotal }));

  // Check SupportReceipt
  const spMatches = await prisma.supportReceipt.findMany({ where: { OR: [{ receiptNumber: orderNumber }, { receiptKey: orderNumber }] }, include: { dailyEntry: true } });
  console.log('SupportReceipt matches:', spMatches.length);
  spMatches.forEach((r) => console.log({ id: r.id, dailyEntryId: r.dailyEntryId, receiptNumber: r.receiptNumber, sellingTotal: r.sellingTotal }));

  // Check MarketingDailyEntry rows for this attendant in current trading period (approx: 25th->24th)
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year; startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear(); endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear(); startMonth = prev.getMonth();
    endYear = year; endMonth = month;
  }
  const periodStart = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const periodEnd = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
  console.log('Trading period:', periodStart.toISOString(), '->', periodEnd.toISOString());

  if (attendantId) {
    const mEntries = await prisma.marketingDailyEntry.findMany({ where: { submittedById: attendantId, date: { gte: periodStart, lte: periodEnd } }, include: { receipts: true, sales: true } });
    console.log('MarketingDailyEntry rows for attendant in period:', mEntries.length);
    for (const e of mEntries) {
      console.log(' entry', e.id, 'date', e.date.toISOString(), 'receiptsCount', (e.receipts || []).length, 'salesCount', (e.sales || []).length);
      (e.receipts || []).forEach(r => console.log('  receipt', { id: r.id, receiptNumber: r.receiptNumber, sellingTotal: r.sellingTotal }));
    }

    // compute marketing totals with exclusion of POS POD-pending canonical keys
    const canonicalize = (s) => (s ? String(s).replace(/\s|-/g, '').toUpperCase() : null);
    const posPending = await prisma.receipt.findMany({ where: { generatedAt: { gte: periodStart, lte: periodEnd }, data: { path: ['podDelivery', 'status'], equals: 'pending' } }, select: { id: true, data: true, order: true } });
    const excluded = new Set(posPending.map(p => canonicalize(p.order?.orderNumber ?? (p.data && p.data.receiptNumber) ?? p.id)));
    console.log('POS POD-pending canonical keys (excluded):', Array.from(excluded));
    let mTotals = { totalSales: 0, totalProfit: 0, totalReceipts: 0 };
    let mTotalsBefore = { totalSales: 0, totalReceipts: 0 };
    const seen = new Set();
    for (const e of mEntries) {
      for (const r of (e.receipts || [])) {
        const key = canonicalize(r.receiptNumber ?? r.id) || (`ID:${r.id}`);
        if (!seen.has(key)) {
          mTotalsBefore.totalSales += Number(r.sellingTotal || 0);
          mTotalsBefore.totalReceipts += 1;
        }
        if (key && excluded.has(key)) {
          // skip
          continue;
        }
        if (seen.has(key)) continue;
        seen.add(key);
        mTotals.totalSales += Number(r.sellingTotal || 0);
        mTotals.totalReceipts += 1;
      }
    }
    console.log('Computed marketing totals BEFORE exclusion:', mTotalsBefore);
    console.log('Computed marketing totals AFTER exclusion:', mTotals);

    const sEntries = await prisma.supportDailyEntry.findMany({ where: { submittedById: attendantId, date: { gte: periodStart, lte: periodEnd } }, include: { receipts: true, sales: true } });
    console.log('SupportDailyEntry rows for attendant in period:', sEntries.length);
    for (const e of sEntries) {
      console.log(' entry', e.id, 'date', e.date.toISOString(), 'receiptsCount', (e.receipts || []).length, 'salesCount', (e.sales || []).length);
      (e.receipts || []).forEach(r => console.log('  receipt', { id: r.id, receiptNumber: r.receiptNumber, sellingTotal: r.sellingTotal }));
    }

    // compute support totals with exclusion
    let sTotals = { totalSales: 0, totalReceipts: 0 };
    let sTotalsBefore = { totalSales: 0, totalReceipts: 0 };
    const seenS = new Set();
    for (const e of sEntries) {
      for (const r of (e.receipts || [])) {
        const key = canonicalize(r.receiptNumber ?? r.id) || (`ID:${r.id}`);
        if (!seenS.has(key)) {
          sTotalsBefore.totalSales += Number(r.sellingTotal || 0);
          sTotalsBefore.totalReceipts += 1;
        }
        if (key && excluded.has(key)) continue;
        if (seenS.has(key)) continue;
        seenS.add(key);
        sTotals.totalSales += Number(r.sellingTotal || 0);
        sTotals.totalReceipts += 1;
      }
    }
    console.log('Computed support totals BEFORE exclusion:', sTotalsBefore);
    console.log('Computed support totals AFTER exclusion:', sTotals);
  }

  // Commission records
  const commRecords = await prisma.commissionRecord.findMany({ where: { orderId: order ? order.id : undefined } });
  console.log('CommissionRecord rows for order:', commRecords.length);
  commRecords.forEach(c => console.log({ id: c.id, status: c.status, amount: c.amount }));

  const orderItems = await prisma.orderItem.findMany({ where: { orderId: order ? order.id : undefined } });
  const orderItemIds = orderItems.map(i => i.id);
  const earnings = await prisma.commissionEarning.findMany({ where: { orderItemId: { in: orderItemIds } } });
  console.log('CommissionEarning rows for order items:', earnings.length);
  earnings.forEach(e => console.log({ id: e.id, staffId: e.staffId, amount: e.amount, status: e.status, calcDetail: e.calcDetail }));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
