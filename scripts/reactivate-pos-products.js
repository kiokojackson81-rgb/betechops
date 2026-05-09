#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Searching for archived POS products...');
    const archived = await prisma.product.findMany({ where: { isActive: false }, select: { id: true, name: true } });
    console.log(`Found ${archived.length} archived product(s).`);
    if (!archived.length) return;

    for (const p of archived) console.log(` - ${p.id} ${p.name}`);

    const confirmed = process.argv.includes('--yes');
    if (!confirmed) {
      console.log('\nRun this script with `--yes` to perform the reactivation (will affect ALL archived products).');
      return;
    }

    const res = await prisma.product.updateMany({ where: { isActive: false }, data: { isActive: true } });
    console.log(`Reactivated ${res.count} product(s).`);
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
}

main();
