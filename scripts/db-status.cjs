require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

(async () => {
  try {
    const byStatus = await prisma.jumiaOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
      orderBy: { status: 'asc' }
    });
    console.log('Order counts by status:\n', byStatus);
  } catch (e) {
    console.error('db-status error:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
