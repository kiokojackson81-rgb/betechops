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
