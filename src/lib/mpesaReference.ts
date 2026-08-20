const MPESA_CODE_PATTERN = /(?:^|[^A-Z0-9])([A-Z0-9]{10})(?=$|[^A-Z0-9])/g;

export function extractMpesaTransactionCode(value: string | null | undefined) {
  const normalized = String(value || "").toUpperCase();
  for (const match of normalized.matchAll(MPESA_CODE_PATTERN)) {
    const candidate = match[1];
    if (/[A-Z]/.test(candidate) && /\d/.test(candidate)) return candidate;
  }
  return null;
}

export function formatMpesaReferenceInput(value: string) {
  const extracted = extractMpesaTransactionCode(value);
  return extracted || value.toUpperCase().replace(/[\r\n]+/g, " ").slice(0, 2000);
}

export function normalizeLppPaymentReference(
  method: "MPESA" | "CASH" | "BANK" | "CARD" | "OTHER",
  value: string | null | undefined,
) {
  const trimmed = String(value || "").trim();
  if (method === "MPESA") {
    const code = extractMpesaTransactionCode(trimmed);
    if (!code) throw new Error("INVALID_MPESA_REFERENCE");
    return code;
  }

  if (method === "CASH") return trimmed || null;
  if (!trimmed) throw new Error("PAYMENT_REFERENCE_REQUIRED");
  return trimmed.toUpperCase().replace(/\s+/g, " ");
}
