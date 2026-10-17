import { getReceiptProjectCompletionDate, readReceiptProjectFlow } from "@/lib/receiptProjects";
import { readReceiptAggregatePricing } from "@/lib/receiptAggregatePricing";
import { isReceiptCancelledForSales } from "@/lib/receiptSalesEligibility";
import { receiptIsFullyPaid } from "@/lib/receiptFinancialState";
import { deliveryStatus, isDeliveryReceipt } from "@/lib/deliveryReceipt";

const record = (value: any): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value : {};
export const recognitionDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * One immutable business-event date for sales and sales-based commissions.
 *
 * Cost/pricing information must never move a completed receipt into a later
 * sales period. Profit reporting may separately use the completed pricing date.
 */
export function getReceiptRecognitionDate(receipt: any): Date | null {
  if (!receipt || isReceiptCancelledForSales(receipt)) return null;
  const data = record(receipt.data);
  const flow = readReceiptProjectFlow(data.projectFlow);
  const historicallyCompleted = Boolean(flow?.isProject && flow.stage === "COMPLETED_POSTED");
  if (!historicallyCompleted && (receipt.order?.paidAmount != null || receipt.order?.paymentStatus != null) && !receiptIsFullyPaid(receipt)) return null;
  const completedAt = flow?.isProject ? getReceiptProjectCompletionDate(flow, undefined, receipt.generatedAt ?? receipt.createdAt) : null;
  if (flow?.isProject && !completedAt && !historicallyCompleted) return null;
  const pod = record(data.podDelivery);
  const aggregate = readReceiptAggregatePricing(receipt);
  const support = receipt.financialPricingEvidence;
  const items = receipt.order?.items ?? [];
  const costsKnown = items.length > 0 && items.every((item: any) => {
    const costs = [...(item.orderCosts ?? [])].sort((a: any, b: any) => (recognitionDate(b.createdAt)?.getTime() ?? 0) - (recognitionDate(a.createdAt)?.getTime() ?? 0));
    return Number(costs[0]?.unitCost ?? item.profitSnapshots?.[0]?.unitCost ?? item.product?.lastBuyingPrice ?? 0) > 0;
  });
  if (!aggregate.isAuthoritativeTotal) {
    if (!historicallyCompleted && (data.needsPricing === true || receipt.totals?.needsPricing === true)) return null;
    if (!historicallyCompleted && support && !support.complete && !costsKnown) return null;
    if (!historicallyCompleted && !support?.complete && !costsKnown && !(aggregate.buyingTotal > 0)) return null;
  }
  if (isDeliveryReceipt(receipt)) {
    if (deliveryStatus(receipt) !== "delivered") return null;
    return recognitionDate(pod.deliveredAt) ?? recognitionDate(data.deliveredAt) ?? recognitionDate(pod.paidAt) ?? recognitionDate(data.externalPayment && record(data.externalPayment).confirmedAt) ?? recognitionDate(receipt.generatedAt ?? receipt.createdAt);
  }
  // A project carries forward only when it was still pending at a period close
  // and is then completed in the new period. Its completion date is therefore
  // authoritative even if costs are entered afterwards.
  if (flow?.isProject) return completedAt;

  // For an ordinary POS sale, issuance is the completed sales event. Do not use
  // financialRecognitionAt, buyingPriceUpdatedAt, support pricedAt, or order-cost
  // timestamps here: those are subsequent accounting actions, not completion.
  return recognitionDate(receipt.generatedAt ?? receipt.createdAt);
}

/**
 * The date on which a receipt's profit becomes reportable.
 *
 * This is deliberately separate from `getReceiptRecognitionDate`: the sale
 * remains in the period in which it was completed, but profit for a sale that
 * needed buying prices later belongs to the day that pricing was completed.
 * When no later pricing action exists, profit remains on the sale date.
 */
export function getReceiptProfitRecognitionDate(receipt: any): Date | null {
  const salesDate = getReceiptRecognitionDate(receipt);
  if (!salesDate) return null;

  const data = record(receipt?.data);
  const totals = record(receipt?.totals);
  const dataTotals = record(data.totals);
  const evidence = record(receipt?.financialPricingEvidence);
  const pricingDates: Date[] = [
    recognitionDate(data.financialRecognitionAt),
    recognitionDate(data.buyingPriceUpdatedAt),
    recognitionDate(totals.buyingPriceUpdatedAt),
    recognitionDate(dataTotals.buyingPriceUpdatedAt),
    recognitionDate(evidence.pricedAt),
    ...(receipt?.order?.items ?? []).flatMap((item: any) =>
      (item?.orderCosts ?? []).map((cost: any) => recognitionDate(cost?.createdAt)),
    ),
  ].filter((value): value is Date => value instanceof Date);

  if (!pricingDates.length) return salesDate;
  return pricingDates.reduce(
    (latest, value) => (value.getTime() > latest.getTime() ? value : latest),
    salesDate,
  );
}

export function recognitionDay(date: Date) {
  const local = new Date(date.getTime() + 3 * 3600000).toISOString().slice(0, 10);
  const start = new Date(`${local}T00:00:00+03:00`);
  return { start, end: new Date(start.getTime() + 86400000 - 1) };
}
