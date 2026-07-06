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
  return new Set([
    "draft",
    "new",
    "contacted",
    "pending",
    "pending_approval",
    "approved",
    "sent",
    "viewed",
    "follow_up",
    "quoted",
    "amount_pending",
    "accepted",
  ]).has(normalized);
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
  return new Set([
    "pending",
    "follow_up",
    "delivery_failed",
    "failed",
    "pod_pending",
    "delivery_pending",
    "payment_pending",
    "balance_pending",
  ]).has(normalized);
}

export function isOpenAgentOrderStatus(status: string | null | undefined) {
  return isOpenWorkItemStatus(status);
}

export function isPendingPosReceiptStatus(
  status: string | null | undefined,
  paymentStatus?: string | null | undefined,
) {
  const normalizedStatus = normalizeStatus(status);
  const normalizedPaymentStatus = normalizeStatus(paymentStatus);

  if (
    new Set([
      "completed",
      "delivered",
      "settled",
      "cancelled",
      "canceled",
      "closed",
      "paid",
      "fully_paid",
      "fully paid",
    ]).has(normalizedStatus)
  ) {
    return false;
  }

  if (new Set(["paid", "settled", "completed", "closed"]).has(normalizedPaymentStatus)) {
    return false;
  }

  return (
    new Set([
      "pending",
      "unpaid",
      "awaiting_payment",
      "awaiting payment",
      "balance_pending",
      "balance pending",
      "payment_pending",
      "payment pending",
      "delivery_pending",
      "delivery pending",
      "settlement_pending",
      "settlement pending",
      "released",
    ]).has(normalizedStatus) ||
    new Set([
      "pending",
      "unpaid",
      "awaiting_payment",
      "awaiting payment",
      "balance_pending",
      "balance pending",
      "payment_pending",
      "payment pending",
      "delivery_pending",
      "delivery pending",
      "settlement_pending",
      "settlement pending",
      "partial",
      "deposit",
    ]).has(normalizedPaymentStatus)
  );
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
    "fulfilled",
    "failed_closed",
    "lost",
    "converted",
  ]).has(normalized);
}

export function shouldShowPendingWorkItem({
  status,
}: {
  status?: string | null;
  createdAt?: DateLike;
  updatedAt?: DateLike;
  periodStart: Date;
  periodEnd: Date;
}) {
  return isOpenWorkItemStatus(status);
}

export function isCarriedForwardPendingItem({
  status,
  createdAt,
  periodStart,
}: {
  status?: string | null;
  createdAt?: DateLike;
  periodStart: Date;
}) {
  const created = toDate(createdAt);
  if (!created) return false;
  return isOpenWorkItemStatus(status) && created < periodStart;
}

export function wasCreatedOrUpdatedInPeriod(
  createdAt: DateLike,
  updatedAt: DateLike,
  period: PeriodBounds,
) {
  return isWithinPeriod(createdAt, period) || isWithinPeriod(updatedAt, period);
}
