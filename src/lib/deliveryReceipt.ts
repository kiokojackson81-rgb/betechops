type ReceiptLike = {
  data?: unknown;
  order?: { paidAmount?: unknown; totalAmount?: unknown; paymentStatus?: unknown } | null;
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
  return String(pod.status || data.deliveryStatus || "pending").trim().toLowerCase() || "pending";
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
