const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rows = await prisma.$queryRaw`SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%user%'`;
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
