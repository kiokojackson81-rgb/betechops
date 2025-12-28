const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getTradingPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year; startMonth = month;
    const next = new Date(year, month+1, 1);
    endYear = next.getFullYear(); endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month-1, 1);
    startYear = prev.getFullYear(); startMonth = prev.getMonth();
    endYear = year; endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0,0,0,0);
  const end = new Date(endYear, endMonth, 24, 23,59,59,999);
  return { start, end };
}

(async () => {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: node debug-user-receipts.js <userId>');
    process.exit(2);
  }
  const period = getTradingPeriodFor(new Date());
  console.log('Period:', period.start.toISOString(), '-', period.end.toISOString());
  try {
    const [marketingEntries, supportEntries] = await Promise.all([
      prisma.marketingDailyEntry.findMany({
        where: { submittedById: userId, date: { gte: period.start, lte: period.end } },
        include: { receipts: true, sales: true },
      }),
      prisma.supportDailyEntry.findMany({
        where: { submittedById: userId, date: { gte: period.start, lte: period.end } },
        include: { receipts: true, sales: true },
      }),
    ]);
    console.log('marketingEntries.count =', marketingEntries.length);
    console.log('supportEntries.count =', supportEntries.length);
    marketingEntries.forEach((e, i) => {
      console.log('ME', i, 'id', e.id, 'receipts', (e.receipts||[]).length, 'sales', (e.sales||[]).length);
    });

    const reports = await prisma.dailyReport.findMany({ where: { userId, date: { gte: period.start, lte: period.end } }, include: { sales: true } });
    console.log('dailyReport.count =', reports.length);
    reports.forEach((r,i) => console.log('DR', i, 'id', r.id, 'sales', (r.sales||[]).length));

    const weeklyRows = await prisma.weeklySale.findMany({ where: { userId, status: 'APPROVED', weekStart: { gte: period.start, lte: period.end } } });
    console.log('weeklySale.count =', weeklyRows.length);

    // list receipts directly in main receipts table for user if any
    const receipts = await prisma.receipt.findMany({ where: { OR: [ { issuedById: userId }, { order: { attendantId: userId } }, { data: { path: ['attendantId'], equals: userId } } ] }, include: { order: true }, take: 200 });
    console.log('pos receipts found =', receipts.length);
    // build canonical keys for marketing receipts and POS receipts and compare
    function normalizeReceiptNumber(input) {
      if (input == null) return '';
      const s = String(input).trim();
      if (!s) return '';
      let out = s.toUpperCase().replace(/([\s\-_]+)/g, '');
      out = out.replace(/[^A-Z0-9]/g, '');
      return out;
    }

    function businessDateKey(date) {
      const d = new Date(date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }

    function buildReceiptKeyFromDateAndSerial(date, raw) {
      const n = normalizeReceiptNumber(raw);
      if (!n) return null;
      return `${businessDateKey(date)}:${n}`;
    }

    const marketingKeys = new Set();
    marketingEntries.forEach((entry) => {
      (entry.receipts || []).forEach((r) => {
        const key = r.receiptKey ? String(r.receiptKey).trim() : buildReceiptKeyFromDateAndSerial(entry.date || entry.createdAt || new Date(), r.receiptNumber ?? r.id);
        if (key) marketingKeys.add(String(key).trim());
      });
      (entry.sales || []).forEach((s) => {
        const key = String(s.receiptNumber ?? '').trim();
        if (key) marketingKeys.add(key);
      });
    });

    const supportKeys = new Set();
    supportEntries.forEach((entry) => {
      (entry.receipts || []).forEach((r) => {
        const key = String(r.receiptKey ?? r.receiptNumber ?? r.id ?? '').trim();
        if (key) supportKeys.add(key);
      });
      (entry.sales || []).forEach((s) => {
        const key = String(s.receiptNumber ?? '').trim();
        if (key) supportKeys.add(key);
      });
    });

    // POS keys: prefer order.orderNumber, normalize and build receiptKey using order.createdAt
    const posInPeriod = receipts.filter(r => {
      const dt = r.order?.createdAt ?? r.generatedAt ?? r.createdAt;
      return dt && new Date(dt) >= period.start && new Date(dt) <= period.end;
    });

    const posKeys = new Set();
    const posNormalizedKeys = new Set();
    posInPeriod.forEach((r) => {
      const raw = r.order?.orderNumber ?? r.orderId ?? r.id ?? '';
      const k = String(raw).trim();
      if (k) posKeys.add(k);
      if (r.order?.orderNumber && r.order?.createdAt) {
        const built = buildReceiptKeyFromDateAndSerial(r.order.createdAt, r.order.orderNumber);
        if (built) posNormalizedKeys.add(built);
      }
    });

    console.log('marketingKeys.count =', marketingKeys.size, 'supportKeys.count =', supportKeys.size, 'posKeysInPeriod.count =', posKeys.size, 'posInPeriod.count =', posInPeriod.length);

    console.log('\n--- marketing receipts detail ---');
    marketingEntries.forEach((entry, ei) => {
      (entry.receipts || []).forEach((r, i) => console.log('MREC', ei, i, { id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, paymentMethod: r.paymentMethod, sellingTotal: r.sellingTotal }));
    });

    console.log('\n--- support receipts detail ---');
    supportEntries.forEach((entry, ei) => {
      (entry.receipts || []).forEach((r, i) => console.log('SREC', ei, i, { id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, paymentMethod: r.paymentMethod, sellingTotal: r.sellingTotal }));
    });

    console.log('\n--- pos receipts in period detail ---');
    posInPeriod.forEach((r,i) => console.log('POSDET', i, { id: r.id, orderNumber: r.order?.orderNumber ?? null, generatedAt: r.generatedAt, orderId: r.orderId }));

    // Compute summarizer-style totalReceipts (marketingPeriodTotals logic)
    const seen = new Set();
    let summaryTotalReceipts = 0;
    const recKeyFn = (s) => String(s ?? '').trim();
    const markIfNewFn = (k) => { const n = recKeyFn(k); if (!n) return false; if (seen.has(n)) return false; seen.add(n); return true; };

    marketingEntries.forEach((entry) => {
      const receipts = entry.receipts || [];
      if (receipts.length > 0) {
        receipts.forEach((r) => {
          const idBase = recKeyFn(r.receiptNumber ?? r.id ?? '');
          if (markIfNewFn(idBase)) summaryTotalReceipts += 1;
        });
      } else {
        const sales = entry.sales || [];
        if (sales.length > 0) {
          const entrySeen = new Set();
          sales.forEach((s, idx) => {
            const idBase = recKeyFn(s.receiptNumber) || `${entry.id}-${idx}`;
            if (entrySeen.has(idBase)) return;
            entrySeen.add(idBase);
            if (markIfNewFn(idBase)) summaryTotalReceipts += 1;
          });
        } else {
          // fallback sale
          const fallbackKey = `${entry.id || entry.date?.toISOString() || 'entry'}|fallback`;
          if (markIfNewFn(fallbackKey)) summaryTotalReceipts += 1;
        }
      }
    });

    // reports (dailyReport)
    // Already queried as `reports` earlier
    (reports || []).forEach((report) => {
      const sales = report.sales || [];
      const entrySalesReceiptKeys = new Set();
      sales.forEach((sale, idx) => {
        const idBase = recKeyFn(sale.receiptNumber) || `${report.id}-${idx}`;
        if (entrySalesReceiptKeys.has(idBase)) return;
        entrySalesReceiptKeys.add(idBase);
        if (markIfNewFn(idBase)) summaryTotalReceipts += 1;
      });
      if (sales.length === 0) {
        const receiptsFromMetrics = Math.max(0, Math.floor(Number(((report.tasks || {}).totals || {}).receipts || 0)));
        if (receiptsFromMetrics > 0) {
          const fallbackKey = `daily-report-${report.id || ''}`;
          if (markIfNewFn(fallbackKey)) summaryTotalReceipts += receiptsFromMetrics;
        }
      }
    });

    console.log('\nSummarizer-style totalReceipts =', summaryTotalReceipts, 'seenKeys =', seen.size);

    const m_p = [...marketingKeys].filter(k => posKeys.has(k));
    const m_p_norm = [...marketingKeys].filter(k => posNormalizedKeys.has(k));
    const m_s = [...marketingKeys].filter(k => supportKeys.has(k));
    const s_p = [...supportKeys].filter(k => posKeys.has(k));
    console.log('marketing ∩ pos =', m_p.length, m_p.slice(0,20));
    console.log('marketing ∩ pos (normalized) =', m_p_norm.length, m_p_norm.slice(0,20));
    console.log('marketing ∩ support =', m_s.length, m_s.slice(0,20));
    console.log('support ∩ pos =', s_p.length, s_p.slice(0,20));

    const unionKeys = new Set([...marketingKeys, ...supportKeys, ...posKeys]);
    const normUnion = new Set([...Array.from(marketingKeys).map(k=>k), ...Array.from(supportKeys).map(k=>k), ...Array.from(posNormalizedKeys).map(k=>k)]);
    // marketingKeys already include date-prefixed keys; posNormalizedKeys are date-prefixed
    console.log('union unique receipt keys across marketing/support/pos (raw) =', unionKeys.size);
    console.log('normalized union unique receipt keys =', normUnion.size, 'sample:', Array.from(normUnion).slice(0,20));

    // show small sample details for posInPeriod first 50
    posInPeriod.slice(0,50).forEach((r,i) => console.log('POS', i, 'id', r.id, 'orderNumber', r.order?.orderNumber ?? null, 'orderId', r.orderId, 'generatedAt', r.generatedAt));

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
  process.exit(0);
})();