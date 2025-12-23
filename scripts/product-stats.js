const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const total = await prisma.product.count();
    const active = await prisma.product.count({ where: { isActive: true } });
    const inactive = await prisma.product.count({ where: { isActive: false } });
    console.log('TOTAL_PRODUCTS_COUNT', total);
    console.log('ACTIVE_PRODUCTS', active);
    console.log('INACTIVE_PRODUCTS', inactive);
    const sample = await prisma.product.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, sku: true, name: true, isActive: true, createdAt: true } });
    console.log('\nSAMPLE:');
    sample.forEach(p => console.log(p.id, p.sku, p.isActive, p.createdAt.toISOString(), p.name));
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
