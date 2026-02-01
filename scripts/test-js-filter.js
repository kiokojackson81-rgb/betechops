const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node scripts/test-js-filter.js <receiptId>');
    process.exit(2);
  }
  try {
    const r = await prisma.receipt.findUnique({ where: { id }, select: { id: true, data: true, totals: true } });
    if (!r) return console.log('not found');
    const normalizedCustomerType = undefined; // emulate default
    const normalizedPodStatus = undefined;

    const included = (() => {
      if (normalizedCustomerType === 'pod') {
        if (normalizedPodStatus) {
          const pod = r.data?.podDelivery;
          return (pod?.status ?? '').toString().toLowerCase() === normalizedPodStatus;
        }
        return true;
      }
      const pod = r.data?.podDelivery;
      return !pod || (pod.status || '').toString().toLowerCase() !== 'pending';
    })();

    console.log('JS-level filter would include receipt?', included);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
