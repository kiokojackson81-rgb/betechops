const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name='User'");
    console.log('columns for User:', rows.map((r) => r.column_name));
  } catch (e) {
    console.error('query failed:', e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
