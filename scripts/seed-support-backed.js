const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function businessDateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

(async () => {
  const userId = process.argv[2];
  const amount = Number(process.argv[3] || 6500);
  if (!userId) {
    console.error('Usage: node seed-support-backed.js <userId> [amount]');
    process.exit(2);
  }
  try {
    const now = new Date();
    const entry = await prisma.supportDailyEntry.create({
      data: {
        date: now,
        dayOfWeek: now.toLocaleDateString('en-KE', { weekday: 'long' }),
        submittedBy: { connect: { id: userId } },
        totalSales: amount,
        totalProfit: amount,
        receipts: {
          create: [
            {
              receiptNumber: `SUP-${Date.now()}`,
              receiptKey: `${businessDateKey(now)}:SUP${Date.now()}`,
              paymentMethod: 'MPESA',
              sellingTotal: amount,
              buyingTotal: 0,
              items: { create: [{ productName: 'Seeded support sale', buyingPrice: 0 }] },
            },
          ],
        },
      },
      include: { receipts: true },
    });

    const receipt = entry.receipts && entry.receipts[0];

    console.log('Created supportDailyEntry', entry.id, 'and supportReceipt', receipt.id);
  } catch (e) {
    console.error('Seed failed:', e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
