const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function desc(table) {
  const res = await prisma.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = ${table}
    ORDER BY ordinal_position
  `;
  console.log(`\nColumns for ${table}:`);
  if (Array.isArray(res) && res.length) {
    for (const r of res) console.log(`- ${r.column_name} (${r.data_type})`);
  } else {
    console.log('  (no columns found)');
  }
}

async function main() {
  await desc('Receipt');
  await desc('Order');
  await desc('User');
  await desc('MarketingReceipt');
  await desc('SupportReceipt');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
