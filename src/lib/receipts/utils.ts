export function canonicalReceiptNumber(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.replace(/\s|-/g, "").toUpperCase();
}

export function businessDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildReceiptKey(entryDate: Date, serial: unknown): string | null {
  const canonical = canonicalReceiptNumber(serial);
  if (!canonical) return null;
  return `${businessDateKey(entryDate)}:${canonical}`;
}

export function parsePaymentMethod(input: unknown, PaymentMethod: any) {
  if (typeof input === "string" && input.toUpperCase() === "CASH") return PaymentMethod.CASH;
  return PaymentMethod.MPESA;
}
