// scripts/count-new-products.js
// Usage: DATABASE_URL="..." node scripts/count-new-products.js --from=2025-11-23 --to=2025-12-24
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const argv = require('minimist')(process.argv.slice(2));
const fromArg = argv.from || argv.start || '2025-11-23';
const toArg = argv.to || argv.end || '2025-12-24';
(async () => {
  try {
    const from = new Date(fromArg + 'T00:00:00Z');
    const to = new Date(toArg + 'T23:59:59.999Z');
    console.log('Range:', from.toISOString(), '->', to.toISOString());
    const count = await prisma.product.count({ where: { createdAt: { gte: from, lte: to } } });
    console.log('New products created in range:', count);
    const sample = await prisma.product.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, sku: true, name: true, createdAt: true } });
    if (sample.length) {
      console.log('\nSample products:');
      sample.forEach(p => console.log(p.id, p.sku, p.name, p.createdAt.toISOString()));
    }
  } catch (e) {
    console.error('Failed:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
})();
