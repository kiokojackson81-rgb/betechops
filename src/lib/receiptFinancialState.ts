import { isReceiptCancelledForSales } from "@/lib/receiptSalesEligibility";
import { readReceiptProjectFlow, isReceiptProjectRecognizedForSales } from "@/lib/receiptProjects";

/** Sales belong to the recorded seller, not every technician or document issuer. */
export function receiptSalesOwner(receipt: any): string | null {
  return receipt?.order?.attendantId || receipt?.data?.attendantId || receipt?.issuedById || null;
}

export function receiptIsFullyPaid(receipt: any): boolean {
  const order = receipt?.order;
  if (order?.paidAmount != null && order?.totalAmount != null) {
    return Number.isFinite(Number(order.paidAmount)) && Number(order.paidAmount) >= Number(order.totalAmount);
  }
  return String(order?.paymentStatus).toUpperCase() === "PAID";
}

export function receiptFinancialExclusion(receipt: any): string | null {
  if (isReceiptCancelledForSales(receipt)) return "Cancelled";
  const flow = readReceiptProjectFlow(receipt?.data?.projectFlow);
  // Projects completed before the balance-verification rule was introduced
  // were already confirmed as paid when they entered COMPLETED_POSTED. Keep
  // that historical confirmation authoritative instead of reclassifying them
  // as unpaid because older orders lack the newer payment fields.
  const historicallyCompleted = Boolean(flow?.isProject && flow.stage === "COMPLETED_POSTED");
  if (!historicallyCompleted && !receiptIsFullyPaid(receipt)) return "Payment outstanding or refunded";
  if (flow?.isProject && !isReceiptProjectRecognizedForSales(receipt.data.projectFlow)) return "Project not financially completed";
  const pod = receipt?.data?.podDelivery;
  if ((pod || receipt?.data?.customerType === "pod") && String(pod?.status).toLowerCase() !== "delivered") return "POD delivery not completed";
  return null;
}
