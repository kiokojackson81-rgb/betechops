const RAW_SYNCED_STATUSES = [
  // Core lifecycle
  "PENDING",
  "PACKED",
  "READY_TO_SHIP",
  "PROCESSING",
  "FULFILLED",
  "COMPLETED",
  "SHIPPED",
  "DELIVERED",
  "FAILED",
  "RETURNED",
  // Vendor spelling uses single-L
  "CANCELED",
  // Internal/partner-specific
  "DISPUTED",
] as const;

export type SyncedStatus = (typeof RAW_SYNCED_STATUSES)[number];

const SYNCED_STATUS_SET = new Set<string>(RAW_SYNCED_STATUSES);

export function normalizeStatus(value?: string | null): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = value.trim().toUpperCase();
  return normalized.length ? normalized : undefined;
}

export function isSyncedStatus(value?: string | null): value is SyncedStatus {
  const normalized = normalizeStatus(value);
  // When forcing DB-backed orders, treat every status as synced so UI uses cached DB path.
  if (String(process.env.NEXT_PUBLIC_ORDERS_FORCE_DB || process.env.ORDERS_FORCE_DB || "").toLowerCase() === "true") {
    return true as any;
  }
  return normalized ? SYNCED_STATUS_SET.has(normalized) : false;
}

export function getSyncedStatuses(): SyncedStatus[] {
  return [...SYNCED_STATUS_SET] as SyncedStatus[];
}
