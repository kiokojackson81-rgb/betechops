import { getReceiptProjectCompletionDate, readReceiptProjectFlow } from "@/lib/receiptProjects";
import { readReceiptAggregatePricing } from "@/lib/receiptAggregatePricing";
import { isReceiptCancelledForSales } from "@/lib/receiptSalesEligibility";

const record = (value: any): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value : {};
export const recognitionDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};
const latest = (values: unknown[]) => values.map(recognitionDate).filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

/** One financial date for sales, costs, profit and commissions. Creation remains audit metadata. */
export function getReceiptRecognitionDate(receipt: any): Date | null {
  if (!receipt || isReceiptCancelledForSales(receipt)) return null;
  const data = record(receipt.data);
  const flow = readReceiptProjectFlow(data.projectFlow);
  const completedAt = flow?.isProject ? getReceiptProjectCompletionDate(flow, undefined, receipt.generatedAt ?? receipt.createdAt) : null;
  if (flow?.isProject && !completedAt) return null;
  const pod = record(data.podDelivery);
  if (Object.keys(pod).length || String(data.customerType).toLowerCase() === "pod") {
    if (String(pod.status).toLowerCase() !== "delivered") return null;
    return recognitionDate(pod.deliveredAt) ?? recognitionDate(pod.paidAt) ?? recognitionDate(pod.financialFinalizedAt) ?? recognitionDate(receipt.generatedAt ?? receipt.createdAt);
  }
  const aggregate = readReceiptAggregatePricing(receipt);
  const support = receipt.financialPricingEvidence;
  const items = receipt.order?.items ?? [];
  const costsKnown = items.length > 0 && items.every((item: any) => {
    const costs = [...(item.orderCosts ?? [])].sort((a: any, b: any) => (recognitionDate(b.createdAt)?.getTime() ?? 0) - (recognitionDate(a.createdAt)?.getTime() ?? 0));
    return Number(costs[0]?.unitCost ?? item.profitSnapshots?.[0]?.unitCost ?? item.product?.lastBuyingPrice ?? 0) > 0;
  });
  if (!aggregate.isAuthoritativeTotal) {
    if (data.needsPricing === true || receipt.totals?.needsPricing === true) return null;
    if (support && !support.complete) return null;
    if (!support?.complete && !costsKnown && !(aggregate.buyingTotal > 0)) return null;
  }
  const pricedAt = recognitionDate(data.financialRecognitionAt)
    ?? recognitionDate(data.buyingPriceUpdatedAt)
    ?? latest([support?.pricedAt, ...items.flatMap((item: any) => (item.orderCosts ?? []).map((cost: any) => cost.createdAt))])
    ?? recognitionDate(receipt.generatedAt ?? receipt.createdAt);
  return completedAt && pricedAt && completedAt > pricedAt ? completedAt : pricedAt;
}

export function recognitionDay(date: Date) {
  const local = new Date(date.getTime() + 3 * 3600000).toISOString().slice(0, 10);
  const start = new Date(`${local}T00:00:00+03:00`);
  return { start, end: new Date(start.getTime() + 86400000 - 1) };
}
