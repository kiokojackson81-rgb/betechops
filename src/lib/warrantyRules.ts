export function technicalConfiguration(value: unknown): string {
  const key = String(value || "").trim().toLowerCase().replace(/[-_\s]+/g, " ");
  if (["hybrid", "hybrid solar pv system"].includes(key)) return "Hybrid Solar PV System";
  if (["off grid", "off grid solar pv system"].includes(key)) return "Off-Grid Solar PV System";
  if (["grid tied", "grid tied solar pv system"].includes(key)) return "Grid-Tied Solar PV System";
  if (["direct dc", "dc", "direct current"].includes(key)) return "Direct-DC Solar System";
  if (["standalone", "solar thermal", "solar thermal system", "standalone / solar thermal"].includes(key)) return "Standalone / Solar Thermal System";
  return "Not recorded";
}

export function warrantyExpiry(start: Date, years: number): string {
  const expiry = new Date(start);
  const day = expiry.getUTCDate();
  expiry.setUTCDate(1);
  expiry.setUTCMonth(expiry.getUTCMonth() + Math.round(years * 12));
  const lastDay = new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate();
  expiry.setUTCDate(Math.min(day, lastDay));
  expiry.setUTCDate(expiry.getUTCDate() - 1);
  return expiry.toISOString();
}

export function liveWarrantyStatus(certificate: { status: string; coverageStatus?: string }, equipment: Array<{ warrantyExpiryDate?: unknown }>, now = new Date()): string {
  if (certificate.status === "SUPERSEDED") return "REPLACED";
  if (certificate.coverageStatus && certificate.coverageStatus !== "ACTIVE") return certificate.coverageStatus;
  if (equipment.length && equipment.every(row => {
    if (typeof row.warrantyExpiryDate !== "string") return false;
    const localDay = new Date(new Date(row.warrantyExpiryDate).getTime() + 3 * 3600000);
    const endOfDay = Date.UTC(localDay.getUTCFullYear(), localDay.getUTCMonth(), localDay.getUTCDate(), 20, 59, 59, 999);
    return endOfDay < now.getTime();
  })) return "EXPIRED";
  return "ACTIVE";
}
