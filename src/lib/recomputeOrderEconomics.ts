import { prisma } from '@/lib/prisma';
import { canonicalReceiptNumber } from '@/lib/receiptGuard';
import { recalcSupportEntry, recalcMarketingEntry } from '@/lib/marketingReceiptCleanup';
import { computeRecognizedReceiptProfit } from '@/lib/recognizedReceiptProfit';

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

    // Persist known buying total, but only recognize profit for priced items.
    let buyingTotal = 0;
    const profitItems = [] as Array<{ quantity: number; sellingPrice: number; buyingPrice: number }>;
    for (const it of order.items || []) {
      const qty = it.quantity || 1;
      const oc = (it.orderCosts && it.orderCosts[0]) ? Number(it.orderCosts[0].unitCost || 0) : 0;
      buyingTotal += oc * qty;
      profitItems.push({
        quantity: qty,
        sellingPrice: Number(it.sellingPrice || 0),
        buyingPrice: oc,
      });
    }

    // update receipt.totals and data.totals if receipt exists
    if (order.receipt) {
      const existingTotals = (order.receipt.totals as any) || {};
      const total = Number(existingTotals.total ?? existingTotals.totalAmount ?? 0);
      const recognized = computeRecognizedReceiptProfit({
        items: profitItems,
        aggregateSellingTotal: total,
        aggregateBuyingTotal: buyingTotal,
      });
      const newTotals = {
        ...(existingTotals || {}),
        buyingTotal,
        profit: recognized.recognizedProfit,
      };
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
    }
  } catch (e) {
    // best-effort
  }
}

export default recomputeOrderEconomics;
