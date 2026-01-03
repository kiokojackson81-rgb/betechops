#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding sample MarketplaceAccount and MarketplaceOrder...');

  const account = await prisma.marketplaceAccount.upsert({
    where: { id: 'seed-test-account' },
    update: {},
    create: {
      id: 'seed-test-account',
      platform: 'JUMIA',
      displayName: 'SEED_TEST_ACCOUNT',
      countryCode: 'KE',
      currency: 'KES',
    },
  });

  const order = await prisma.marketplaceOrder.create({
    data: {
      accountId: account.id,
      platform: 'JUMIA',
      orderId: 'TEST-ORDER-1',
      orderItemId: 'TEST-ORDER-ITEM-1',
      status: 'DELIVERED',
      orderedAt: new Date(),
      productName: 'Test product (seed)',
      productUrl: 'https://example.com/test-product',
      sellingPrice: '1500.00',
      currency: 'KES',
      buyingPrice: null,
      sellerFee: '150.00',
      shippingFee: '100.00',
      profit: null,
      isReturned: false,
      rawPayload: {
        order: {
          id: 'TEST-ORDER-1',
          itemId: 'TEST-ORDER-ITEM-1',
          sellingPrice: 1500,
          fees: {
            seller_fee: 150,
            shipping_fee: 100
          }
        }
      }
    },
  });

  console.log('Created MarketplaceOrder:', order.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
