"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeStatus = normalizeStatus;
exports.isSyncedStatus = isSyncedStatus;
exports.getSyncedStatuses = getSyncedStatuses;
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
];
const SYNCED_STATUS_SET = new Set(RAW_SYNCED_STATUSES);
function normalizeStatus(value) {
    if (value === null || value === undefined)
        return undefined;
    const normalized = value.trim().toUpperCase();
    return normalized.length ? normalized : undefined;
}
function isSyncedStatus(value) {
    const normalized = normalizeStatus(value);
    // When forcing DB-backed orders, treat every status as synced so UI uses cached DB path.
    if (String(process.env.NEXT_PUBLIC_ORDERS_FORCE_DB || process.env.ORDERS_FORCE_DB || "").toLowerCase() === "true") {
        return true;
    }
    return normalized ? SYNCED_STATUS_SET.has(normalized) : false;
}
function getSyncedStatuses() {
    return [...SYNCED_STATUS_SET];
}
