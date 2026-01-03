// scripts/agg-brendah-all.js
// Usage: DATABASE_URL="..." node scripts/agg-brendah-all.js brendah@betech.co.ke
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const emailOrId = process.argv[2] || 'brendah@betech.co.ke';
(async () => {
  try {
    let user = null;
    if (/^[0-9a-fA-F-]{10,}$/.test(emailOrId)) {
      user = await prisma.user.findUnique({ where: { id: emailOrId }, select: { id: true, email: true, name: true } });
    }
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: String(emailOrId).toLowerCase() }, select: { id: true, email: true, name: true } });
    }
    if (!user) {
      console.error('User not found for', emailOrId);
      process.exitCode = 2;
      return;
    }
    const userId = user.id;
    console.log('User:', userId, user.email, user.name || '');

    // POS receipts where order.attendantId = userId
    const pos = await prisma.receipt.findMany({ where: { order: { attendantId: userId } }, select: { id: true, totals: true } });
    const posCount = pos.length;
    const posSum = pos.reduce((s, r) => s + (Number(r.totals?.total) || 0), 0);

    // receipts where issuedById = userId
    const issued = await prisma.receipt.findMany({ where: { issuedById: userId }, select: { id: true, totals: true } });
    const issuedCount = issued.length;
    const issuedSum = issued.reduce((s, r) => s + (Number(r.totals?.total) || 0), 0);

    // receipts with data.attendantId = userId
    let dataAttCount = 0, dataAttSum = 0;
    try {
      const dataAtt = await prisma.receipt.findMany({ where: { data: { path: ['attendantId'], equals: userId } }, select: { id: true, totals: true } });
      dataAttCount = dataAtt.length;
      dataAttSum = dataAtt.reduce((s, r) => s + (Number(r.totals?.total) || 0), 0);
    } catch (e) {
      // some Prisma versions may not support JSON path; ignore
    }

    // marketing receipts linked to marketing_daily_entry
    const mkt = await prisma.marketingReceipt.findMany({ where: { dailyEntry: { submittedById: userId } }, select: { id: true, sellingTotal: true } });
    const mktCount = mkt.length;
    const mktSum = mkt.reduce((s, r) => s + (Number(r.sellingTotal) || 0), 0);

    // support receipts similarly
    let supCount = 0, supSum = 0;
    try {
      const sup = await prisma.supportReceipt.findMany({ where: { dailyEntry: { submittedById: userId } }, select: { id: true, sellingTotal: true } });
      supCount = sup.length;
      supSum = sup.reduce((s, r) => s + (Number(r.sellingTotal) || 0), 0);
    } catch(e) {}

    // Totals
    const totalSales = posSum + issuedSum + dataAttSum + mktSum + supSum;
    const totalCount = posCount + issuedCount + dataAttCount + mktCount + supCount;

    console.log('\nPOS: count=', posCount, 'sum=', posSum.toFixed(2));
    console.log('Issued: count=', issuedCount, 'sum=', issuedSum.toFixed(2));
    console.log('Data.attendantId: count=', dataAttCount, 'sum=', dataAttSum.toFixed(2));
    console.log('Marketing receipts: count=', mktCount, 'sum=', mktSum.toFixed(2));
    console.log('Support receipts: count=', supCount, 'sum=', supSum.toFixed(2));
    console.log('\nAGGREGATE: total_count=', totalCount, 'total_sales=', totalSales.toFixed(2));

  } catch (e) {
    console.error('Failed:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
})();
