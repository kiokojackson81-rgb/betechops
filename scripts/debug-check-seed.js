#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const accountId = 'seed-test-account';
  console.log('Checking MarketplaceAccount', accountId);

  const account = await prisma.marketplaceAccount.findUnique({
    where: { id: accountId },
    include: { orders: true, assignments: { include: { attendant: true } } },
  });

  console.log('\nAccount:');
  console.log(JSON.stringify(account, null, 2));

  const orders = await prisma.marketplaceOrder.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\nOrders count:', orders.length);
  for (const o of orders) {
    console.log(JSON.stringify({
      id: o.id,
      orderId: o.orderId,
      orderItemId: o.orderItemId,
      status: o.status,
      buyingPrice: o.buyingPrice,
      sellerFee: o.sellerFee,
      shippingFee: o.shippingFee,
      profit: o.profit,
      isReturned: o.isReturned,
    }, null, 2));
  }

  const assignments = await prisma.marketplaceAccountAssignment.findMany({
    where: { accountId },
    include: { attendant: true },
  });

  console.log('\nAssignments count:', assignments.length);
  console.log(JSON.stringify(assignments, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
