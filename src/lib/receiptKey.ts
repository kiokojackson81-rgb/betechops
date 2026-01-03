const WHITESPACE_REGEX = /\s+/g;
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const DASH_CLUSTER_REGEX = /-+/g;

export function normalizeReceiptId(value?: string | null): string {
  if (!value) return "";
  return String(value)
    .replace(ZERO_WIDTH_REGEX, "")
    .trim()
    .replace(WHITESPACE_REGEX, " ")
    .replace(DASH_CLUSTER_REGEX, "-")
    .toUpperCase();
}

export function receiptIdFromAny(obj: any): string {
  if (!obj || typeof obj !== "object") return "";
  const candidates = [
    obj.receiptNumber,
    obj.serial,
    obj.order?.orderNumber,
    obj.id,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeReceiptId(candidate);
    if (normalized) return normalized;
  }
  return "";
}

// New canonical utilities requested by Quick Stats work
export type PaymentBreakdown = {
  mpesa: number;
  cash: number;
  countMpesaReceipts?: number;
  countCashReceipts?: number;
};

export function normalizeReceiptNumber(input: unknown): string {
  if (input == null) return "";
  const s = String(input);
  const trimmed = s.trim();
  if (!trimmed) return "";
  // Uppercase, remove spaces/hyphens/underscores
  let out = trimmed.toUpperCase().replace(/[\s\-_]+/g, "");
  // Keep only alphanumerics
  out = out.replace(/[^A-Z0-9]/g, "");
  return out;
}

export function normalizePaymentMethod(value: unknown): "MPESA" | "CASH" {
  const s = typeof value === "string" ? value.trim().toUpperCase() : "";
  return s === "CASH" ? "CASH" : "MPESA";
}

export function buildReceiptKey(rawReceiptNumber: string | null | undefined, fallbackId?: string): string {
  const n = normalizeReceiptNumber(rawReceiptNumber);
  if (n && n.length > 0) return n;
  if (fallbackId) return `ID:${String(fallbackId)}`;
  return "";
}

export function mergePaymentStats(acc: PaymentBreakdown, incoming: PaymentBreakdown) {
  acc.mpesa = (acc.mpesa || 0) + (incoming.mpesa || 0);
  acc.cash = (acc.cash || 0) + (incoming.cash || 0);

  if (incoming.mpesa && incoming.mpesa > 0) {
    acc.countMpesaReceipts = (acc.countMpesaReceipts || 0) + 1;
  }
  if (incoming.cash && incoming.cash > 0) {
    acc.countCashReceipts = (acc.countCashReceipts || 0) + 1;
  }

  return acc;
}
