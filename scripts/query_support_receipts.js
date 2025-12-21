const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const receiptNumbers = ['1030','uy69','1032','8000u','1038','1036','1037','1031','1042','1044','1035','1045'];

  const receipts = await prisma.supportReceipt.findMany({
    where: { receiptNumber: { in: receiptNumbers } },
    include: { items: true }
  });

  console.log(JSON.stringify({ receipts }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
