#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
(async function(){
  const arg = process.argv[2] || 'Betech-20260131';
  const prefix = arg.startsWith('contains:') ? null : arg;
  const contains = arg.startsWith('contains:') ? arg.replace(/^contains:/, '') : null;
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const whereClause = prefix ? { id: { startsWith: prefix } } : { id: { contains } };
    const rows = await prisma.receipt.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 100,
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
