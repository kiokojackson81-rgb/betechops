#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const receiptId = process.argv[2];
if (!receiptId) {
  console.error('Usage: node scripts/delete-receipt.js <receiptId>');
  process.exit(1);
}

(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findUnique({
        where: { id: receiptId },
        include: { order: { include: { items: true, layawayPlan: true } } },
      });

      if (!receipt) {
        console.log('Receipt not found:', receiptId);
        return;
      }

      const order = receipt.order;
      if (!order) throw new Error('Associated order missing');
      const orderId = order.id;

      if (order.orderNumber) {
        await tx.marketingReceipt.deleteMany({ where: { receiptNumber: order.orderNumber } });
        await tx.supportReceipt.deleteMany({ where: { receiptNumber: order.orderNumber } });
      }

      const itemIds = (order.items || []).map((i) => i.id);
      if (itemIds.length) {
        await tx.commissionEarning.deleteMany({ where: { orderItemId: { in: itemIds } } });
      }

      await tx.commissionRecord.deleteMany({ where: { orderId } });
      await tx.returnAdjustment.deleteMany({ where: { returnCase: { orderId } } });
      await tx.returnCase.deleteMany({ where: { orderId } });
      await tx.settlementRow.deleteMany({ where: { orderId } });

      if (order.layawayPlan) {
        await tx.layawayPlan.delete({ where: { id: order.layawayPlan.id } });
      }

      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.receipt.delete({ where: { id: receiptId } });
      await tx.order.delete({ where: { id: orderId } });
    });

    console.log('Deletion completed for', receiptId);
  } catch (err) {
    console.error('Failed to delete receipt:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
