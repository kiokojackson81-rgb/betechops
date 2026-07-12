import {
  normalizeQuoteRequestStatus,
  QUOTE_REQUEST_ACTIONABLE_STATUSES,
} from "@/lib/quoteRequestStatus";

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

export function isPendingQuotationStatus(status: string | null | undefined) {
  const canonical = normalizeQuoteRequestStatus(status);
  return (QUOTE_REQUEST_ACTIONABLE_STATUSES as readonly string[]).includes(canonical);
}

export function isOpenQuotationStatus(status: string | null | undefined) {
  const canonical = normalizeQuoteRequestStatus(status);
  return (
    isPendingQuotationStatus(canonical) ||
    canonical === "QUOTED"
  );
}

export function isWebsiteQuotationRequestSource(source: string | null | undefined) {
  return String(source ?? "").trim().toUpperCase() === "WEBSITE_REQUEST";
}

export function isOpenWebsiteQuotationRequest(input: {
  status?: string | null;
  source?: string | null;
}) {
  return isWebsiteQuotationRequestSource(input.source) && isOpenQuotationStatus(input.status);
}

export function summarizeVoiceQueueItems<T extends { type?: string | null }>(
  items: T[] | null | undefined,
) {
  const queueItems = Array.isArray(items) ? items : [];
  let missedCount = 0;
  let followUpCount = 0;

  for (const item of queueItems) {
    const normalizedType = String(item?.type ?? "").trim().toLowerCase();
    if (normalizedType === "lead") {
      missedCount += 1;
      continue;
    }
    if (normalizedType === "task") {
      followUpCount += 1;
    }
  }

  return {
    queueCount: missedCount + followUpCount,
    missedCount,
    followUpCount,
  };
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
