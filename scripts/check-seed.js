const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { id: 'seed-attendant-1' } });
  console.log('user:', user);
  const shop = await prisma.shop.findUnique({ where: { id: 'seed-shop-1' } });
  console.log('shop:', shop);
  const orders = await prisma.order.findMany({ where: { attendantId: 'seed-attendant-1' }, include: { items: true } });
  console.log('orders:', orders);
  const receipts = await prisma.receipt.findMany({ where: { issuedById: 'seed-attendant-1' } });
  console.log('receipts:', receipts);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
