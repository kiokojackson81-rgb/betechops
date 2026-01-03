// scripts/list-new-products.js
// Usage: DATABASE_URL="..." node scripts/list-new-products.js --from=2025-11-25 --to=2025-12-24 --limit=500 --csv
const { PrismaClient } = require('@prisma/client');
const argv = require('minimist')(process.argv.slice(2));
const prisma = new PrismaClient();
const fromArg = argv.from || argv._[0] || '2025-11-25';
const toArg = argv.to || '2025-12-24';
const limit = argv.limit ? parseInt(argv.limit, 10) : 1000;
const outCsv = argv.csv || false;
(async () => {
  try {
    const from = new Date(fromArg + 'T00:00:00Z');
    const to = new Date(toArg + 'T23:59:59.999Z');
    const products = await prisma.product.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { id: true, sku: true, name: true, createdAt: true, updatedAt: true, sellingPrice: true }, orderBy: { createdAt: 'desc' }, take: limit });
    console.log('Found', products.length, 'new products between', fromArg, 'and', toArg);
    if (outCsv) {
      const rows = products.map(p => `${p.id},"${p.sku}","${(p.name||'').replace(/"/g,'""')}",${p.sellingPrice||''},${p.createdAt.toISOString()}`);
      const csv = 'id,sku,name,sellingPrice,createdAt\n' + rows.join('\n');
      const fs = require('fs');
      const path = `tmp/new-products-${fromArg}_to_${toArg}.csv`;
      fs.mkdirSync('tmp', { recursive: true });
      fs.writeFileSync(path, csv);
      console.log('Wrote CSV to', path);
    } else {
      products.forEach(p => console.log(p.id, p.sku, p.name, p.sellingPrice, p.createdAt.toISOString()));
    }
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
