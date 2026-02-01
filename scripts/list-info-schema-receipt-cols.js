const { PrismaClient } = require('@prisma/client');
(async function(){
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT table_name,column_name FROM information_schema.columns WHERE column_name ILIKE '%receipt%' OR column_name ILIKE '%receiptnumber%' LIMIT 200`);
    console.log('Columns matching receipt:');
    console.dir(rows, { depth: 3 });
  } catch (e) {
    console.error('Query failed:', e && e.message ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
})();
