type ReceiptLike = {
  data?: unknown;
  // Different read paths select different order fields. Delivery state lives
  // on the receipt data, so the helper must accept both a full order ledger
  // and lightweight review/referral projections.
  order?: unknown;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export type DeliveryPaymentTerm = "PAY_BEFORE_DELIVERY" | "PAY_ON_DELIVERY";

export function deliveryPaymentTerm(value: unknown): DeliveryPaymentTerm {
  return String(value).trim().toUpperCase() === "PAY_ON_DELIVERY"
    ? "PAY_ON_DELIVERY"
    : "PAY_BEFORE_DELIVERY";
}

export function isDeliveryReceipt(receipt: ReceiptLike): boolean {
  const data = record(receipt?.data);
  return ["delivery", "pod"].includes(String(data.customerType || "").trim().toLowerCase()) || Boolean(data.podDelivery);
}

export function deliveryStatus(receipt: ReceiptLike): string {
  const data = record(receipt?.data);
  const pod = record(data.podDelivery);
  const order = record(receipt?.order);
  const customerType = String(data.customerType || "").trim().toLowerCase();
  const recordedStatus = String(pod.status || data.deliveryStatus || "").trim().toLowerCase();
  // An explicitly failed/cancelled delivery must never be upgraded by its
  // payment/order state. This keeps unsuccessful deliveries out of sales and
  // commission reporting.
  if (["failed", "delivery_failed", "cancelled", "canceled"].includes(recordedStatus)) {
    return recordedStatus;
  }
  // Website/countrywide orders are completed from the order desk. Older
  // receipt snapshots can retain `deliveryStatus: pending` after that update,
  // so treating the canonical DELIVERED order state as pending incorrectly
  // hides an already completed sale from commission and reporting.
  const orderStatus = String(order.status || "").trim().toUpperCase();
  if (orderStatus === "DELIVERED") {
    return "delivered";
  }
  // Standard prepaid deliveries are completed from the receipt desk as
  // COMPLETED. They do not use the separate POD collection workflow, so that
  // completed state is the final delivery confirmation unless staff have
  // explicitly recorded a failed/cancelled delivery above.
  if (customerType === "delivery" && orderStatus === "COMPLETED") {
    return "delivered";
  }
  return recordedStatus || "pending";
}

export function isDeliveryCompleted(receipt: ReceiptLike): boolean {
  return !isDeliveryReceipt(receipt) || deliveryStatus(receipt) === "delivered";
}

export function deliveryPaymentLabel(receipt: ReceiptLike): string | null {
  if (!isDeliveryReceipt(receipt)) return null;
  const data = record(receipt.data);
  const pod = record(data.podDelivery);
  return deliveryPaymentTerm(data.deliveryPaymentTerm || pod.type) === "PAY_ON_DELIVERY"
    ? "Pay on delivery"
    : "Pay before delivery";
}
