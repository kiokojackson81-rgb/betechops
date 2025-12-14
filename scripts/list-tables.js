require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename ILIKE '%daily%'");
  console.log('matching tables:', rows.map(r => r.tablename).join(', '));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
