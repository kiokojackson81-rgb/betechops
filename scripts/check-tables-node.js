const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sql = `SELECT 
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Order') AS order_exists,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') AS user_exists,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Receipt') AS receipt_exists
  `;
  const res = await prisma.$queryRawUnsafe(sql);
  console.log(JSON.stringify(res[0] || res));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
