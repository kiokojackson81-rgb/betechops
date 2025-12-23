// scripts/check-stephen-receipts.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Usage: node scripts/check-stephen-receipts.js <emailOrId> [startISO] [endISO]
const arg = process.argv[2] || 'stephen@betech.co.ke';
const startArg = process.argv[3] || '2025-11-24T00:00:00+03:00';
const endArg = process.argv[4] || '2025-12-24T23:59:59.999+03:00';

(async () => {
  try {
    // try to find user by id or email
    let user = null;
    if (/^[0-9a-fA-F-]{10,}$/.test(arg)) {
      user = await prisma.user.findUnique({ where: { id: arg }, select: { id: true, email: true, name: true } });
    }
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: arg.toLowerCase() }, select: { id: true, email: true, name: true } });
    }
    if (!user) {
      console.error('User not found for', arg);
      process.exitCode = 2;
      return;
    }
    const userId = user.id;
    console.log('Found user:', userId, user.email, user.name || '');

    const start = new Date(startArg);
    const end = new Date(endArg);
    console.log('Range:', start.toISOString(), '->', end.toISOString());

    // POS receipts where order.attendantId = userId
    const pos = await prisma.receipt.findMany({
      where: { generatedAt: { gte: start, lte: end }, order: { attendantId: userId } },
      select: { id: true, generatedAt: true, totals: true, order: { select: { orderNumber: true } }, issuedById: true },
      orderBy: { generatedAt: 'desc' },
    });
    console.log(`POS receipts where order.attendantId = ${userId}: ${pos.length}`);
    pos.forEach(r => console.log(r.id, r.order?.orderNumber, (r.totals||{}).total, r.generatedAt.toISOString(), 'issuedBy', r.issuedById));

    // receipts where issuedById = userId
    const issued = await prisma.receipt.findMany({ where: { issuedById: userId, generatedAt: { gte: start, lte: end } }, select: { id: true, generatedAt: true, totals: true, order: { select: { orderNumber: true } } }, orderBy: { generatedAt: 'desc' } });
    console.log(`Receipts where issuedById = ${userId}: ${issued.length}`);
    issued.forEach(r => console.log(r.id, r.order?.orderNumber, (r.totals||{}).total, r.generatedAt.toISOString()));

    // receipts with data.attendantId = userId
    const dataAtt = await prisma.receipt.findMany({ where: { generatedAt: { gte: start, lte: end }, data: { path: ['attendantId'], equals: userId } }, select: { id: true, generatedAt: true, totals: true, data: true }, orderBy: { generatedAt: 'desc' } });
    console.log(`Receipts with data.attendantId = ${userId}: ${dataAtt.length}`);
    dataAtt.forEach(r => console.log(r.id, (r.totals||{}).total, r.generatedAt.toISOString()));

    // marketing receipts submittedById
    const mkt = await prisma.marketingReceipt.findMany({ where: { dailyEntry: { submittedById: userId, date: { gte: start, lte: end } } }, select: { id: true, receiptNumber: true, sellingTotal: true, createdAt: true, dailyEntry: { select: { id: true, date: true } } }, orderBy: { createdAt: 'desc' } });
    console.log(`Marketing receipts submittedById = ${userId}: ${mkt.length}`);
    mkt.forEach(r => console.log(r.id, r.receiptNumber, r.sellingTotal, r.createdAt.toISOString()));

    // support receipts submittedById
    const sup = await prisma.supportReceipt.findMany({ where: { dailyEntry: { submittedById: userId, date: { gte: start, lte: end } } }, select: { id: true, receiptNumber: true, sellingTotal: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
    console.log(`Support receipts submittedById = ${userId}: ${sup.length}`);
    sup.forEach(r => console.log(r.id, r.receiptNumber, r.sellingTotal, r.createdAt.toISOString()));

  } catch (e) {
    console.error('Failed to run check:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
})();
