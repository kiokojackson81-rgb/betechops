const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const receiptNumber = 'Betech-20251212-20927';

    const support = await prisma.supportReceipt.findFirst({
      where: { receiptNumber },
      include: { items: true },
    });

    const receipt = await prisma.receipt.findFirst({
      where: { order: { orderNumber: receiptNumber } },
      include: { order: true },
    });

    if (!support) {
      console.log('FAIL: supportReceipt not found for', receiptNumber);
      return process.exitCode = 2;
    }
    if (!receipt) {
      console.log('FAIL: receipt/order not found for', receiptNumber);
      return process.exitCode = 2;
    }

    const supportBuyingTotal = (support.items || []).reduce((s, it) => s + Number(it.buyingPrice ?? 0), 0);
    const receiptTotal = Number(receipt.totals?.total ?? receipt.order?.totalAmount ?? 0);
    const profit = receiptTotal - supportBuyingTotal;

    console.log('Receipt:', receiptNumber);
    console.log('- receiptTotal:', receiptTotal);
    console.log('- support.items count:', (support.items || []).length);
    console.log('- supportBuyingTotal (sum of support items.buyingPrice):', supportBuyingTotal);
    console.log('- profit (receiptTotal - supportBuyingTotal):', profit);

    const expectedBuying = 1256 * 5;
    const expectedProfit = 11000 - expectedBuying;
    console.log('\nExpected buyingTotal:', expectedBuying, 'Expected profit:', expectedProfit);

    const ok = supportBuyingTotal === expectedBuying && profit === expectedProfit;
    console.log('\nSMOKE RESULT:', ok ? 'PASS' : 'FAIL');
    process.exitCode = ok ? 0 : 3;
  } catch (err) {
    console.error('ERROR', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  } finally {
    await PrismaClient.prototype.$disconnect.call(new PrismaClient());
  }
}

if (require.main === module) main();

module.exports = { main };
