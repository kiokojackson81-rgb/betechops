#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    const email = process.argv[2] || 'brendah@betech.co.ke';
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
    if (!user) return console.error('user not found', email);

    // Use the known active period (Dec 25, 2025 -> Jan 24, 2026)
    const start = new Date('2025-12-25T00:00:00.000Z');
    const end = new Date('2026-01-24T23:59:59.999Z');

    const [marketingAgg, supportAgg, ledgers] = await Promise.all([
      prisma.marketingReceipt.aggregate({ where: { createdAt: { gte: start, lte: end }, dailyEntry: { submittedById: user.id } }, _sum: { sellingTotal: true, buyingTotal: true }, _count: { id: true } }),
      prisma.supportReceipt.aggregate({ where: { createdAt: { gte: start, lte: end }, dailyEntry: { submittedById: user.id } }, _sum: { sellingTotal: true, buyingTotal: true }, _count: { id: true } }),
      prisma.commissionLedger.findMany({ where: { userId: user.id, OR: [ { AND: [{ periodStart: start }, { periodEnd: end }] }, { periodStart: { gte: new Date(start.getTime() - 24*60*60*1000), lte: new Date(start.getTime() + 24*60*60*1000) } } ] }, orderBy: { createdAt: 'desc' } }),
    ]);

    const marketing = { totalSales: Number(marketingAgg._sum.sellingTotal ?? 0), totalProfit: Number((marketingAgg._sum.sellingTotal ?? 0) - (marketingAgg._sum.buyingTotal ?? 0)), entries: marketingAgg._count.id };
    const support = { totalSales: Number(supportAgg._sum.sellingTotal ?? 0), totalProfit: Number((supportAgg._sum.sellingTotal ?? 0) - (supportAgg._sum.buyingTotal ?? 0)), entries: supportAgg._count.id };

    const mergedSales = marketing.totalSales + support.totalSales;
    const mergedProfit = marketing.totalProfit + support.totalProfit;

    console.log(JSON.stringify({ user: { id: user.id, email: user.email }, period: { id: period.id, start, end }, marketing, support, merged: { mergedSales, mergedProfit }, ledgers }, null, 2));
  } catch (e) {
    console.error('Error', e && e.message ? e.message : e);
    process.exitCode = 2;
  } finally {
    try { await prisma.$disconnect(); } catch(_){}
  }
})();
