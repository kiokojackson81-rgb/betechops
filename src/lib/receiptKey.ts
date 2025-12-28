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
