const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const start = new Date('2025-12-12T00:00:00+03:00');
    const end = new Date('2025-12-12T23:59:59.999+03:00');
    const entries = await prisma.supportDailyEntry.findMany({ where: { date: { gte: start, lte: end } } });
    console.log(JSON.stringify(entries, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await new PrismaClient().$disconnect();
  }
}

if (require.main === module) main();
