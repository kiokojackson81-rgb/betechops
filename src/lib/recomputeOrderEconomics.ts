import { prisma } from '@/lib/prisma';
import { canonicalReceiptNumber } from '@/lib/receiptGuard';
import { recalcSupportEntry, recalcMarketingEntry } from '@/lib/marketingReceiptCleanup';

export async function recomputeOrderEconomics(orderId: string) {
  if (!orderId) return;

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { orderCosts: { orderBy: { createdAt: 'desc' }, take: 1 } } },
        receipt: true,
      },
    });
    if (!order) return;

    // compute buying total from latest orderCost.unitCost per item
    let buyingTotal = 0;
    for (const it of order.items || []) {
      const qty = it.quantity || 1;
      const oc = (it.orderCosts && it.orderCosts[0]) ? Number(it.orderCosts[0].unitCost || 0) : 0;
      buyingTotal += oc * qty;
    }

    // update receipt.totals and data.totals if receipt exists
    if (order.receipt) {
      const existingTotals = (order.receipt.totals as any) || {};
      const total = Number(existingTotals.total ?? existingTotals.totalAmount ?? 0);
      const newTotals = { ...(existingTotals || {}), buyingTotal, profit: total && buyingTotal ? total - buyingTotal : 0 };
      try {
        await tx.receipt.update({ where: { id: order.receipt.id }, data: { totals: newTotals, data: { ...(order.receipt.data as any), totals: newTotals } } });
      } catch (e) {
        // best-effort
      }
    }

    // update supportReceipt / marketingReceipt buyingTotal for canonical receipt number
    if (order.orderNumber) {
      try {
        const normalized = canonicalReceiptNumber(order.orderNumber) || order.orderNumber;
        const support = await tx.supportReceipt.findFirst({ where: { receiptNumber: normalized }, orderBy: { updatedAt: 'desc' } });
        if (support) {
          await tx.supportReceipt.update({ where: { id: support.id }, data: { buyingTotal } });
          if (support.dailyEntryId) await recalcSupportEntry(tx as any, support.dailyEntryId);
        }
        const marketing = await tx.marketingReceipt.findFirst({ where: { receiptNumber: normalized }, orderBy: { updatedAt: 'desc' } });
        if (marketing) {
          await tx.marketingReceipt.update({ where: { id: marketing.id }, data: { buyingTotal } });
          if (marketing.dailyEntryId) await recalcMarketingEntry(tx as any, marketing.dailyEntryId);
        }
      } catch (e) {
        // ignore best-effort
      }
    }
  });

  // recompute support ledger for attendant if present
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const attendantId = order?.attendantId ?? null;
    if (attendantId) {
      const { getTradingPeriodFor } = await import('@/lib/tradingPeriod');
      const { recomputeSupportCommissionLedger } = await import('@/lib/supportCommission');
      const period = getTradingPeriodFor(new Date());
      await recomputeSupportCommissionLedger({ userId: attendantId, period });
      try {
        const { recomputeDirectSalesLedger } = await import('@/lib/directSalesLedger');
        await recomputeDirectSalesLedger({ userId: attendantId, period });
      } catch (e) {
        // best-effort: update direct sales ledger when available
      }
    }
  } catch (e) {
    // best-effort
  }
}

export default recomputeOrderEconomics;
