export function canonicalReceiptNumber(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.replace(/\s|-/g, "").toUpperCase();
}

export function parsePaymentMethod(input: unknown, PaymentMethod: any) {
  if (typeof input === "string" && input.toUpperCase() === "CASH") return PaymentMethod.CASH;
  return PaymentMethod.MPESA;
}
