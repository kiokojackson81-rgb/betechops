const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const productIds = [
    'cmjsouw5h0000ju046e2csndn',
    'cmjsouw5q0001ju04jdijys4j',
    'cmjsouw600002ju04ormbzf81',
  ];
  const candidatePrices = [20800, 10400];

  console.log('Looking for ProductCost rows for productIds or candidate prices');
  const byIds = await prisma.$queryRaw`
    SELECT id, "productId", price, "createdAt" FROM "ProductCost" WHERE "productId" = ANY(${productIds}) ORDER BY "createdAt" DESC
  `;
  console.log('\nProductCost rows for the order productIds:', Array.isArray(byIds) ? byIds.length : 0);
  if (Array.isArray(byIds) && byIds.length) console.dir(byIds, { depth: 2 });

  const byPrice = await prisma.$queryRaw`
    SELECT id, "productId", price, "createdAt" FROM "ProductCost" WHERE price = ANY(${candidatePrices}) ORDER BY "createdAt" DESC
  `;
  console.log('\nProductCost rows with candidate prices (20800,10400):', Array.isArray(byPrice) ? byPrice.length : 0);
  if (Array.isArray(byPrice) && byPrice.length) console.dir(byPrice, { depth: 2 });

  // Also show Product table entries for those ids
  const prods = await prisma.$queryRaw`
    SELECT id, name, "lastBuyingPrice", "sellingPrice" FROM "Product" WHERE id = ANY(${productIds})
  `;
  console.log('\nProducts info:');
  if (Array.isArray(prods) && prods.length) console.dir(prods, { depth: 2 });
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(async () => { await prisma.$disconnect(); });
