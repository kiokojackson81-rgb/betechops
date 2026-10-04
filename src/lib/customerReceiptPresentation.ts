import { readReceiptProjectFlow } from "@/lib/receiptProjects";
import { deliveryPaymentLabel, deliveryStatus, isDeliveryReceipt } from "@/lib/deliveryReceipt";

export const receiptMoney = (value: number) => `KSh ${new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const amount = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

function formatProjectStage(stage: string) {
  switch (stage) {
    case "RECEIPT_CREATED": return "Awaiting confirmation";
    case "PROJECT_SCHEDULED": return "Scheduled";
    case "PROJECT_IN_PROGRESS": return "In progress";
    case "PROJECT_INSTALLED": return "Installation complete";
    case "COMPLETED_POSTED": return "Completed";
    case "CANCELLED": return "Cancelled";
    default: return "Project being prepared";
  }
}

function formatProjectDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" }).format(date)
    : null;
}

/** The live order ledger is authoritative, including for commissioned projects. */
export function customerReceiptPresentation(receipt: {
  receiptNumber?: string | null; data?: unknown; discount?: unknown; showDiscount?: boolean | null;
  order: { customerName: string; orderNumber: string; totalAmount: number; paidAmount: number; items?: unknown[]; mpesaPayments?: Array<{ transactionAt: Date | null }>; layawayPlan?: { payments: Array<{ paidAt: Date }> } | null };
}) {
  const { order } = receipt;
  const data = record(receipt.data);
  const projectFlow = readReceiptProjectFlow(data.projectFlow ?? record(data.metadata).projectFlow);
  const paid = amount(order.paidAmount);
  const total = amount(order.totalAmount);
  const balance = Math.round(Math.max(0, total - paid) * 100) / 100;
  const dates = [data.paymentDate, record(data.podDelivery).paidAt, record(data.externalPayment).confirmedAt,
    record(data.adminPaymentConfirmation).confirmedAt, record(data.commissioningPaymentConfirmation).confirmedAt,
    ...(order.mpesaPayments || []).map(p => p.transactionAt), ...(order.layawayPlan?.payments || []).map(p => p.paidAt)]
    .filter((value): value is Date | string | number => value instanceof Date || typeof value === "string" || typeof value === "number")
    .map(value => new Date(value)).filter(value => Number.isFinite(value.getTime()));
  const lastPayment = paid > 0 && dates.length ? new Date(Math.max(...dates.map(date => date.getTime()))) : null;
  const rawItems = order.items?.length ? order.items : Array.isArray(data.items) ? data.items : [];
  const items = rawItems.map((rawItem: unknown, index: number) => {
    const item = record(rawItem);
    const quantity = amount(item.quantity ?? 1);
    const unitPrice = amount(item.sellingPrice ?? item.unitPrice ?? item.price);
    return {
      id: String(item.id || index), name: String(record(item.product).name || item.title || item.productName || item.name || "Purchased item"),
      quantity, unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  // The order ledger is the final agreed amount. Older receipts occasionally
  // have a saved line-item price but no saved discount, so infer the visible
  // discount only when the item subtotal is higher than that ledger amount.
  const explicitDiscount = amount(receipt.discount ?? data.discount);
  const discount = Math.round(Math.max(explicitDiscount, subtotal > total ? subtotal - total : 0) * 100) / 100;
  const showDiscount = Boolean(receipt.showDiscount || data.showDiscount || discount > 0);
  const isDelivery = isDeliveryReceipt(receipt);
  const currentDeliveryStatus = isDelivery ? deliveryStatus(receipt) : null;
  const paymentPendingOnDelivery = isDelivery && deliveryPaymentLabel(receipt) === "Pay on delivery" && paid <= 0;
  return {
    customerName: order.customerName,
    receiptNumber: receipt.receiptNumber || order.orderNumber,
    paid, balance, total, subtotal, discount, showDiscount,
    status: paymentPendingOnDelivery ? "Payment pending" : balance === 0 ? "Paid in full" : paid > 0 ? "Partially paid" : "Awaiting payment",
    paymentDate: lastPayment ? new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" }).format(lastPayment) : paid > 0 ? "Not recorded" : "No payment yet",
    project: projectFlow
      ? {
          stage: projectFlow.stage,
          stageLabel: formatProjectStage(projectFlow.stage),
          scheduledDate: formatProjectDate(projectFlow.scheduledDate),
        }
      : null,
    delivery: isDelivery
      ? {
          status: currentDeliveryStatus,
          paymentLabel: deliveryPaymentLabel(receipt),
        }
      : null,
    items,
  };
}

export type CustomerReceiptPresentation = ReturnType<typeof customerReceiptPresentation>;
