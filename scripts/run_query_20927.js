const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const prisma = new PrismaClient();
  try {
    const sql = fs.readFileSync('./scripts/query_20927_compare.sql', 'utf8');
    // Split into individual statements (simple split on ";" is OK for our two-statement file)
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      try {
        const rows = await prisma.$queryRawUnsafe(stmt);
        const out = JSON.stringify(rows, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
        console.log(out);
      } catch (err) {
        console.error('Statement error:', err.message || err);
      }
    }
  } catch (err) {
    console.error('ERROR', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
