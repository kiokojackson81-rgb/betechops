const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const rows = await prisma.weeklySale.findMany({
      where: { source: 'AUTOMATIC', weekStart: { gte: cutoff } },
      orderBy: { weekStart: 'desc' },
      take: 100,
      select: { id: true, shopId: true, platform: true, weekStart: true, weekEnd: true, amount: true, source: true, status: true, createdAt: true },
    });
    console.log('Recent automatic WeeklySale rows:', rows.length);
    console.dir(rows, { depth: null });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
