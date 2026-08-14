import { Prisma } from "@prisma/client";

export const LPP_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "DUE_SOON",
  "OVERDUE",
  "ON_HOLD",
  "COMPLETED",
  "AWAITING_CONVERSION",
  "CONVERTED_TO_POS",
  "CONVERTED_TO_PROJECT",
  "CANCELLED",
  "REFUNDED",
  "CLOSED",
] as const;

export type LipaPolePoleStatus = (typeof LPP_STATUSES)[number];

export const LPP_PAYMENT_STATUSES = [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "REVERSED",
] as const;

export type LipaPolePolePaymentStatus = (typeof LPP_PAYMENT_STATUSES)[number];

export const LPP_PAYMENT_MODES = [
  "FLEXIBLE",
  "SCHEDULED",
] as const;

export type LipaPolePolePaymentMode = (typeof LPP_PAYMENT_MODES)[number];

export const LPP_PAYMENT_METHODS = [
  "MPESA",
  "CASH",
  "BANK",
  "CARD",
  "OTHER",
] as const;

export type LipaPolePolePaymentMethod = (typeof LPP_PAYMENT_METHODS)[number];

export const LPP_RESERVATION_MODES = [
  "NONE",
  "SOFT_RESERVE",
  "HARD_RESERVE",
] as const;

export type LipaPolePoleReservationMode = (typeof LPP_RESERVATION_MODES)[number];

export type LppPaymentLike = {
  amount: Prisma.Decimal | string | number;
  status: string;
};

export type LppFinancialSummary = {
  agreedTotal: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  balance: Prisma.Decimal;
  percentagePaid: Prisma.Decimal;
  isFullyPaid: boolean;
};

const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);

export function toMoneyDecimal(value: Prisma.Decimal | string | number | null | undefined) {
  if (value instanceof Prisma.Decimal) return value;
  if (value === null || value === undefined || value === "") return ZERO;
  return new Prisma.Decimal(value);
}

export function normalizeLppStatus(value: unknown): LipaPolePoleStatus {
  const candidate = String(value || "").trim().toUpperCase();
  if (LPP_STATUSES.includes(candidate as LipaPolePoleStatus)) {
    return candidate as LipaPolePoleStatus;
  }
  return "DRAFT";
}

export function normalizeLppPaymentStatus(value: unknown): LipaPolePolePaymentStatus {
  const candidate = String(value || "").trim().toUpperCase();
  if (LPP_PAYMENT_STATUSES.includes(candidate as LipaPolePolePaymentStatus)) {
    return candidate as LipaPolePolePaymentStatus;
  }
  return "PENDING";
}

export function sumSuccessfulLppPayments(payments: readonly LppPaymentLike[]) {
  return payments.reduce((sum, payment) => {
    if (normalizeLppPaymentStatus(payment.status) !== "SUCCESS") return sum;
    return sum.add(toMoneyDecimal(payment.amount));
  }, ZERO);
}

export function computeLppFinancialSummary(input: {
  agreedTotal: Prisma.Decimal | string | number;
  payments: readonly LppPaymentLike[];
}) : LppFinancialSummary {
  const agreedTotal = toMoneyDecimal(input.agreedTotal);
  const totalPaid = sumSuccessfulLppPayments(input.payments);
  const rawBalance = agreedTotal.sub(totalPaid);
  const balance = Prisma.Decimal.max(rawBalance, ZERO);
  const percentagePaid =
    agreedTotal.lte(ZERO)
      ? ZERO
      : Prisma.Decimal.min(
          ONE_HUNDRED,
          totalPaid.mul(ONE_HUNDRED).div(agreedTotal).toDecimalPlaces(2),
        );

  return {
    agreedTotal,
    totalPaid,
    balance,
    percentagePaid,
    isFullyPaid: totalPaid.gte(agreedTotal) && agreedTotal.gt(ZERO),
  };
}

export function deriveLppOperationalStatus(input: {
  currentStatus?: unknown;
  agreedTotal: Prisma.Decimal | string | number;
  payments: readonly LppPaymentLike[];
  expectedCompletionDate?: Date | string | null;
  convertedReceiptId?: string | null;
  convertedProjectId?: string | null;
  fulfilledAt?: Date | string | null;
  cancelledAt?: Date | string | null;
  refundedAt?: Date | string | null;
  now?: Date;
}) : LipaPolePoleStatus {
  const current = normalizeLppStatus(input.currentStatus);
  const summary = computeLppFinancialSummary({
    agreedTotal: input.agreedTotal,
    payments: input.payments,
  });

  if (input.cancelledAt) return "CANCELLED";
  if (input.refundedAt) return "REFUNDED";
  if (input.fulfilledAt) return "CLOSED";
  if (input.convertedReceiptId) return "CONVERTED_TO_POS";
  if (input.convertedProjectId) return "CONVERTED_TO_PROJECT";
  if (summary.isFullyPaid) {
    return current === "COMPLETED" ? "COMPLETED" : "AWAITING_CONVERSION";
  }

  if (current === "ON_HOLD") return "ON_HOLD";
  if (current === "DRAFT") return "DRAFT";

  const now = input.now ?? new Date();
  const expectedCompletionDate = input.expectedCompletionDate ? new Date(input.expectedCompletionDate) : null;
  if (expectedCompletionDate && !Number.isNaN(expectedCompletionDate.getTime())) {
    if (expectedCompletionDate < now) return "OVERDUE";
    const msUntilDue = expectedCompletionDate.getTime() - now.getTime();
    if (msUntilDue <= 7 * 24 * 60 * 60 * 1000) return "DUE_SOON";
  }

  return "ACTIVE";
}

export function assertLppEligibleForConversion(input: {
  status?: unknown;
  agreedTotal: Prisma.Decimal | string | number;
  payments: readonly LppPaymentLike[];
  convertedReceiptId?: string | null;
  convertedProjectId?: string | null;
}) {
  const status = normalizeLppStatus(input.status);
  const summary = computeLppFinancialSummary({
    agreedTotal: input.agreedTotal,
    payments: input.payments,
  });

  if (!summary.isFullyPaid) {
    throw new Error("LPP_BALANCE_NOT_ZERO");
  }
  if (input.convertedReceiptId || input.convertedProjectId) {
    throw new Error("LPP_ALREADY_CONVERTED");
  }
  if (!["COMPLETED", "AWAITING_CONVERSION", "ACTIVE", "DUE_SOON", "OVERDUE"].includes(status)) {
    throw new Error("LPP_STATUS_NOT_ELIGIBLE_FOR_CONVERSION");
  }
}

export function assertLppEligibleForRelease(input: {
  agreedTotal: Prisma.Decimal | string | number;
  payments: readonly LppPaymentLike[];
  converted: boolean;
  transactionFullyPaid: boolean;
}) {
  const summary = computeLppFinancialSummary({
    agreedTotal: input.agreedTotal,
    payments: input.payments,
  });

  if (!summary.isFullyPaid || !input.converted || !input.transactionFullyPaid) {
    throw new Error("PRODUCT_NOT_ELIGIBLE_FOR_RELEASE");
  }
}

export function generateLppReference(input: {
  date?: Date;
  sequence: number;
}) {
  const date = input.date ?? new Date();
  const year = date.getUTCFullYear();
  const sequence = Math.max(1, Math.trunc(input.sequence));
  return `LPP-${year}-${String(sequence).padStart(6, "0")}`;
}

export function buildLppReminderIdempotencyKey(input: {
  lppId: string;
  reminderType: string;
  dueDate: Date | string;
  channel?: string | null;
}) {
  const dueDate = new Date(input.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    throw new Error("INVALID_DUE_DATE");
  }
  const channel = String(input.channel || "INTERNAL").trim().toUpperCase();
  return `${input.lppId}:${String(input.reminderType || "").trim().toUpperCase()}:${channel}:${dueDate.toISOString().slice(0, 10)}`;
}
