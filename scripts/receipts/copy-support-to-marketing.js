#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reconcile({ userEmail }) {
  // Find user id for email (case-insensitive)
  const user = await prisma.user.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
  if (!user) throw new Error('User not found: ' + userEmail);

  // find marketing receipts for user's marketingDailyEntry rows in current trading period
  // We'll process receipts that have buyingTotal = 0 but a matching supportReceipt with buyingTotal > 0

  const marketing = await prisma.marketingReceipt.findMany({
    where: { buyingTotal: 0 },
    include: { dailyEntry: true, items: true },
  });

  let updated = 0;
  for (const m of marketing) {
    // try to find a matching supportReceipt by receiptKey or receiptNumber and same date/dailyEntry submittedById == user.id
    const key = m.receiptKey || m.receiptNumber;
    if (!key) continue;

    const support = await prisma.supportReceipt.findFirst({
      where: {
        OR: [{ receiptKey: key }, { receiptNumber: key }],
      },
      include: { items: true, dailyEntry: true },
    });
    if (!support) continue;

    // Ensure support entry is from the target user (served by)
    const servedByMatches = support.dailyEntry && support.dailyEntry.submittedById === user.id;
    // If dailyEntry isn't available or doesn't match, still proceed cautiously

    if (support.buyingTotal && support.buyingTotal > 0) {
      // copy buyingTotal and items buyingPrice
      const tx = await prisma.$transaction(async (tx) => {
        // update marketing receipt buyingTotal
        await tx.marketingReceipt.update({ where: { id: m.id }, data: { buyingTotal: support.buyingTotal } });

        // delete existing marketing items and recreate from support items (to capture buying prices)
        if (m.items && m.items.length > 0) {
          await tx.marketingReceiptItem.deleteMany({ where: { receiptId: m.id } });
        }
        if (support.items && support.items.length > 0) {
          const itemsToCreate = support.items.map((it) => ({ productName: it.productName || it.description || 'item', buyingPrice: it.buyingPrice || 0 }));
          await tx.marketingReceiptItem.createMany({ data: itemsToCreate.map(d => ({ ...d, receiptId: m.id })) });
        }

        return true;
      });

      updated += 1;
      console.log('Updated marketingReceipt', m.id, 'from support', support.id, 'servedByMatches=', servedByMatches);
    }
  }

  return { updated };
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node copy-support-to-marketing.js <userEmail>');
    process.exit(2);
  }
  try {
    const res = await reconcile({ userEmail: email });
    console.log('Done. Updated marketing receipts:', res.updated);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
