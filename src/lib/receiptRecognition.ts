import { getReceiptProjectCompletionDate, readReceiptProjectFlow } from "@/lib/receiptProjects";
import { readReceiptAggregatePricing } from "@/lib/receiptAggregatePricing";
import { isReceiptCancelledForSales } from "@/lib/receiptSalesEligibility";
import { receiptIsFullyPaid } from "@/lib/receiptFinancialState";

const record = (value: any): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value : {};
export const recognitionDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * One immutable business-event date for sales, costs, profit and commissions.
 *
 * Cost/pricing information is an eligibility requirement, not a new sale event.
 * A later price entry must never move a completed receipt into a later trading
 * period, otherwise the same sale can be counted twice across payroll periods.
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
  if (Object.keys(pod).length || String(data.customerType).toLowerCase() === "pod") {
    if (String(pod.status).toLowerCase() !== "delivered") return null;
    return recognitionDate(pod.deliveredAt) ?? recognitionDate(pod.paidAt) ?? recognitionDate(pod.financialFinalizedAt) ?? recognitionDate(receipt.generatedAt ?? receipt.createdAt);
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

export function recognitionDay(date: Date) {
  const local = new Date(date.getTime() + 3 * 3600000).toISOString().slice(0, 10);
  const start = new Date(`${local}T00:00:00+03:00`);
  return { start, end: new Date(start.getTime() + 86400000 - 1) };
}
