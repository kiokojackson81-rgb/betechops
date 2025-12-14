export function parseNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const s = String(value).trim();
  if (!s) return fallback;
  // Remove common thousands separators and currency symbols, keep digits, dot and minus
  const cleaned = s.replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-." ) return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

export function parseIntLike(value: unknown, fallback = 0) {
  const n = parseNumber(value, NaN as unknown as number);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n) || fallback;
}

export default parseNumber;
