/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  let shop = await prisma.shop.findFirst({ where: { name: 'Main Shop', location: 'Nairobi CBD' } });
  if (!shop) {
    shop = await prisma.shop.create({ data: { name: 'Main Shop', location: 'Nairobi CBD', phone: '+254722151083', email: 'shop@betech.co.ke' } });
  }

  const attendant = await prisma.user.upsert({
    where: { email: 'attendant@betech.co.ke' },
    update: {},
    create: { email: 'attendant@betech.co.ke', name: 'Default Attendant', role: 'ATTENDANT', isActive: true },
  });

  const product = await prisma.product.upsert({
    where: { sku: 'BAT-100AH' },
    update: {},
    create: { sku: 'BAT-100AH', name: '100Ah Solar Battery', category: 'Battery', sellingPrice: 12000, lastBuyingPrice: 10000, stockQuantity: 10 },
  });

  console.log({ shop: shop.id, attendant: attendant.email, product: product.sku });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
