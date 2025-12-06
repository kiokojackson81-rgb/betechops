const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const tables = await prisma.$queryRaw`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name`;
    console.log('count', tables.length);
    console.log(tables.map(t => t.table_name));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
