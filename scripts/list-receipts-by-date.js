#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
(async function(){
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const start = new Date('2026-01-31T00:00:00Z');
    const end = new Date('2026-02-01T00:00:00Z');
    const rows = await prisma.receipt.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, orderId: true, createdAt: true, data: true }
    });
    console.log('found', rows.length);
    rows.forEach(r => console.log(r.id, r.orderId || '-', r.createdAt, r.data && r.data.podDelivery ? 'pod:' + JSON.stringify(r.data.podDelivery) : 'pod:NULL'));
  } catch (e) {
    console.error('error', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
