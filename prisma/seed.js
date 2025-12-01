/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  let shop = await prisma.shop.findFirst({ where: { name: 'Main Shop', location: 'Nairobi CBD' } });
  if (!shop) {
    shop = await prisma.shop.create({ data: { name: 'Main Shop', location: 'Nairobi CBD', phone: '+254722151083', email: 'shop@betech.co.ke' } });
  }

  const attendant = await prisma.user.upsert({
    where: { email: 'attendant@betech.co.ke' },
    update: {},
    create: { email: 'attendant@betech.co.ke', name: 'Default Attendant', role: 'ATTENDANT', isActive: true, attendantCategory: 'DIRECT_SALES' },
  });

  const product = await prisma.product.upsert({
    where: { sku: 'BAT-100AH' },
    update: {},
    create: { sku: 'BAT-100AH', name: '100Ah Solar Battery', category: 'Battery', sellingPrice: 12000, lastBuyingPrice: 10000, stockQuantity: 10 },
  });

  // seed admin + attendants with hashed passwords (safe to run multiple times)
  // The target database uses a different enum naming for AttendantCategory.
  // Map our desired semantic categories to the existing DB enum labels so
  // the seed can run without altering the DB enum type.
  const users = [
    {
      email: 'jackson@betech.co.ke',
      name: 'Jackson',
      password: bcrypt.hashSync('Ads0k015@#', 10),
      role: 'ADMIN',
      // map BETECH_OPS -> GENERAL (administrative/general ops)
      attendantCategory: 'GENERAL',
    },
    {
      email: 'jeniffer@betech.co.ke',
      name: 'Jeniffer',
      password: bcrypt.hashSync('Jeniffer@#2020', 10),
      role: 'ATTENDANT',
      // map DIRECT_SALES_OPS -> DIRECT_SALES
      attendantCategory: 'DIRECT_SALES',
    },
    {
      email: 'stephen@betech.co.ke',
      name: 'Stephen',
      password: bcrypt.hashSync('stephen@#2020', 10),
      role: 'ATTENDANT',
      // map JUMIA_KILIMALL_OPS -> JUMIA_OPERATIONS (Jumia-focused)
      attendantCategory: 'JUMIA_OPERATIONS',
    },
    {
      email: 'brendah@betech.co.ke',
      name: 'Brendah',
      password: bcrypt.hashSync('brendah@#2020', 10),
      role: 'ATTENDANT',
      // map MARKETING_OPS -> PRODUCT_UPLOAD (best available fit)
      attendantCategory: 'PRODUCT_UPLOAD',
    },
    {
      email: 'benjamin@betech.co.ke',
      name: 'Benjamin',
      password: bcrypt.hashSync('benjamin@#2020', 10),
      role: 'ATTENDANT',
      attendantCategory: 'GENERAL',
    },
  ];

  for (const u of users) {
    try {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          password: u.password,
          role: u.role,
          attendantCategory: u.attendantCategory,
          isActive: true,
        },
        create: {
          email: u.email,
          name: u.name,
          password: u.password,
          role: u.role,
          attendantCategory: u.attendantCategory,
          isActive: true,
        },
      });
      console.log('Seeded', u.email);
    } catch (err) {
      console.error('Error seeding', u.email, err.message || err);
    }
  }

  console.log({ shop: shop.id, attendant: attendant.email, product: product.sku });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
