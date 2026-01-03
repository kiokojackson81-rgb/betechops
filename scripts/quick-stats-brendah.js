// scripts/quick-stats-brendah.js
// Usage: DATABASE_URL="..." node scripts/quick-stats-brendah.js --from=2025-11-25 --to=2025-12-24
const { PrismaClient } = require('@prisma/client');
const argv = require('minimist')(process.argv.slice(2));
const prisma = new PrismaClient();

const userEmailOrId = argv._[0] || 'brendah@betech.co.ke';
const fromArg = argv.from || argv.f || '2025-11-25';
const toArg = argv.to || argv.t || '2025-12-24';
const commissionRate = Number(argv.rate || 0.1);

(async () => {
  try {
    // find user
    let user = null;
    if (/^[0-9a-fA-F-]{10,}$/.test(userEmailOrId)) {
      user = await prisma.user.findUnique({ where: { id: userEmailOrId }, select: { id: true, email: true, name: true } });
    }
    if (!user) user = await prisma.user.findUnique({ where: { email: String(userEmailOrId).toLowerCase() }, select: { id: true, email: true, name: true } });
    if (!user) return console.error('User not found', userEmailOrId);
    const userId = user.id;

    const from = new Date(fromArg + 'T00:00:00Z');
    const to = new Date(toArg + 'T23:59:59.999Z');

    // marketing receipts within dailyEntry.date range
    const marketingReceipts = await prisma.marketingReceipt.findMany({
      where: { dailyEntry: { submittedById: userId, date: { gte: from, lte: to } } },
      select: { id: true, sellingTotal: true },
    });

    const mktCount = marketingReceipts.length;
    const mktSum = marketingReceipts.reduce((s, r) => s + (Number(r.sellingTotal) || 0), 0);

    // support receipts
    let supportReceipts = [];
    try {
      supportReceipts = await prisma.supportReceipt.findMany({ where: { dailyEntry: { submittedById: userId, date: { gte: from, lte: to } } }, select: { id: true, sellingTotal: true } });
    } catch (e) {}
    const supCount = supportReceipts.length;
    const supSum = supportReceipts.reduce((s, r) => s + (Number(r.sellingTotal) || 0), 0);

    // POS receipts: order.attendantId or issuedById or data.attendantId
    const posByOrder = await prisma.receipt.findMany({ where: { generatedAt: { gte: from, lte: to }, order: { attendantId: userId } }, select: { id: true, totals: true } });
    const posByIssued = await prisma.receipt.findMany({ where: { generatedAt: { gte: from, lte: to }, issuedById: userId }, select: { id: true, totals: true } });
    let posByData = [];
    try {
      posByData = await prisma.receipt.findMany({ where: { generatedAt: { gte: from, lte: to }, data: { path: ['attendantId'], equals: userId } }, select: { id: true, totals: true } });
    } catch (e) {}

    // combine unique receipts ids to avoid double count
    const allPos = [...posByOrder, ...posByIssued, ...posByData];
    const uniquePosMap = new Map();
    allPos.forEach(r => { uniquePosMap.set(r.id, r); });
    const uniquePos = Array.from(uniquePosMap.values());
    const posCount = uniquePos.length;
    const posSum = uniquePos.reduce((s, r) => s + (Number(r.totals?.total) || 0), 0);

    // receipts total count = unique pos + marketing + support? The UI probably counts receipts (marketing + support + pos unique)
    // To avoid double counting, ensure marketing/support receipts are distinct from pos receipts (different tables). We'll sum counts.
    const totalReceiptsCount = posCount + mktCount + supCount;
    const totalSales = posSum + mktSum + supSum;

    // product counts in the range
    const newProducts = await prisma.product.count({ where: { createdAt: { gte: from, lte: to } } });
    // edited products approximated by updatedAt in range but created earlier
    const editedProducts = await prisma.product.count({ where: { updatedAt: { gte: from, lte: to }, createdAt: { lt: from } } });
    // copied products: heuristic—products with sku starting with 'manual-'? earlier UI showed large number; fallback: count products created in range named 'manual-'
    const copiedProducts = await prisma.product.count({ where: { sku: { startsWith: 'manual-' }, createdAt: { gte: from, lte: to } } });

    // commission estimate: use marketing profit * rate (only marketing receipts with buying data counted)
    // get marketing receipts with buying info
    const marketingWithBuying = await prisma.marketingReceipt.findMany({ where: { dailyEntry: { submittedById: userId, date: { gte: from, lte: to } }, OR: [{ buyingTotal: { gt: 0 } }, { items: { some: { buyingPrice: { gt: 0 } } } }] }, include: { items: true } });
    let totalProfit = 0;
    marketingWithBuying.forEach(r => {
      const selling = Number(r.sellingTotal) || 0;
      const buying = r.buyingTotal && Number(r.buyingTotal) > 0 ? Number(r.buyingTotal) : (r.items || []).reduce((s, it) => s + (Number(it.buyingPrice) || 0), 0);
      if (buying > 0) totalProfit += selling - buying;
    });
    const commissionEstimate = totalProfit * commissionRate;

    console.log('Period:', fromArg, '->', toArg);
    console.log('\nRECEIPTS count (pos unique + marketing + support):', totalReceiptsCount);
    console.log('SALES (KES):', totalSales.toFixed(2));
    console.log('NEW PRODUCTS:', newProducts);
    console.log('EDITED PRODUCTS:', editedProducts);
    console.log('COPIED PRODUCTS (heuristic):', copiedProducts);
    console.log('COMMISSION (estimate @ ' + (commissionRate*100) + '% of marketing profit):', Math.round(commissionEstimate));

    // also print breakdown
    console.log('\nBreakdown: posCount=', posCount, 'posSum=', posSum.toFixed(2));
    console.log('marketingCount=', mktCount, 'marketingSum=', mktSum.toFixed(2));
    console.log('supportCount=', supCount, 'supportSum=', supSum.toFixed(2));

  } catch (e) {
    console.error('ERR', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
})();
