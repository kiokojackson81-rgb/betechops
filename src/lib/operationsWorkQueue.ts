type PeriodBounds = {
  start: Date;
  end: Date;
};

type DateLike = string | Date | null | undefined;

function normalizeStatus(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase();
}

function toDate(value: DateLike) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinPeriod(value: DateLike, period: PeriodBounds) {
  const date = toDate(value);
  if (!date) return false;
  return date >= period.start && date <= period.end;
}

export function isOpenQuotationStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return new Set(["new", "contacted", "pending", "follow_up", "quoted", "amount_pending"]).has(normalized);
}

export function isPendingWebOrderStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return new Set([
    "pending",
    "new",
    "unpaid",
    "awaiting_payment",
    "awaiting payment",
    "awaiting_confirmation",
    "awaiting confirmation",
    "processing",
    "confirmed",
    "receipt_issued",
    "receipt issued",
    "dispatched",
    "payment_confirmed",
    "payment confirmed",
  ]).has(normalized);
}

export function isPendingPodStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return new Set(["pending", "follow_up", "delivery_failed", "failed"]).has(normalized);
}

export function isOpenWorkItemStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  if (!normalized) return false;
  return !new Set([
    "completed",
    "cancelled",
    "canceled",
    "rejected",
    "closed",
    "settled",
    "delivered",
    "failed_closed",
    "lost",
    "converted",
  ]).has(normalized);
}

export function wasCreatedOrUpdatedInPeriod(
  createdAt: DateLike,
  updatedAt: DateLike,
  period: PeriodBounds,
) {
  return isWithinPeriod(createdAt, period) || isWithinPeriod(updatedAt, period);
}
