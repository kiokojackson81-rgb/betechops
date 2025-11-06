const RAW_SYNCED_STATUSES = [
  "PENDING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
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
  return normalized ? SYNCED_STATUS_SET.has(normalized) : false;
}

export function getSyncedStatuses(): SyncedStatus[] {
  return [...SYNCED_STATUS_SET] as SyncedStatus[];
}
