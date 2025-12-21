const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const prisma = new PrismaClient();
  try {
    const sql = fs.readFileSync('./scripts/reconcile_20251212.sql', 'utf8');
    const rows = await prisma.$queryRawUnsafe(sql);
    const out = JSON.stringify(rows, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
    console.log(out);
  } catch (err) {
    console.error('ERROR', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
