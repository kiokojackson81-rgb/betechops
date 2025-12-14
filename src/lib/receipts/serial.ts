export function generateReceiptSerial() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  return `Betech-${y}${m}${d}-${rand}`;
}

export function normalizeReceiptSerial(raw?: string) {
  const base = (raw && String(raw).trim()) || generateReceiptSerial();
  if (base.startsWith("Betech")) return base;
  if (base.toUpperCase().startsWith("BETECH")) return `Betech${base.slice(6)}`;
  return `Betech-${base}`;
}
