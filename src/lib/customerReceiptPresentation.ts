export const receiptMoney = (value: number) => `KSh ${new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const amount = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

/** The live order ledger is authoritative, including for commissioned projects. */
export function customerReceiptPresentation(receipt: {
  receiptNumber?: string | null; data?: unknown;
  order: { customerName: string; orderNumber: string; totalAmount: number; paidAmount: number; items?: unknown[]; mpesaPayments?: Array<{ transactionAt: Date | null }>; layawayPlan?: { payments: Array<{ paidAt: Date }> } | null };
}) {
  const { order } = receipt;
  const data = record(receipt.data);
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
  return {
    customerName: order.customerName,
    receiptNumber: receipt.receiptNumber || order.orderNumber,
    paid, balance, total,
    status: balance === 0 ? "Paid in full" : paid > 0 ? "Partially paid" : "Awaiting payment",
    paymentDate: lastPayment ? new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" }).format(lastPayment) : paid > 0 ? "Not recorded" : "No payment yet",
    items: rawItems.map((rawItem: unknown, index: number) => {
      const item = record(rawItem);
      return {
      id: String(item.id || index), name: String(record(item.product).name || item.title || item.productName || item.name || "Purchased item"),
      quantity: amount(item.quantity ?? 1), unitPrice: amount(item.sellingPrice ?? item.unitPrice ?? item.price),
      lineTotal: amount(item.sellingPrice ?? item.unitPrice ?? item.price) * amount(item.quantity ?? 1),
    }; }),
  };
}

export type CustomerReceiptPresentation = ReturnType<typeof customerReceiptPresentation>;
