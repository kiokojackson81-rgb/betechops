// scripts/find-blender-products.js
// Usage: DATABASE_URL="..." node scripts/find-blender-products.js --q=blender --from=2025-11-25 --to=2025-12-24
const { PrismaClient } = require('@prisma/client');
const argv = require('minimist')(process.argv.slice(2));
const prisma = new PrismaClient();
const q = (argv.q || argv._[0] || 'blender').toString();
const fromArg = argv.from;
const toArg = argv.to;
(async () => {
  try {
    const where = { name: { contains: q, mode: 'insensitive' } };
    if (fromArg && toArg) {
      const from = new Date(fromArg + 'T00:00:00Z');
      const to = new Date(toArg + 'T23:59:59.999Z');
      where.createdAt = { gte: from, lte: to };
    }
    const products = await prisma.product.findMany({ where, select: { id: true, sku: true, name: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'desc' } });
    console.log('Found', products.length, 'products matching', q);
    products.forEach(p => console.log(p.id, p.sku, p.name, p.createdAt.toISOString()));
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
