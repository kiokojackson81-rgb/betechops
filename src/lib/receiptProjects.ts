export const RECEIPT_PROJECT_STAGES = [
  "RECEIPT_CREATED",
  "PROJECT_IN_PROGRESS",
  "COMPLETED_POSTED",
] as const;

export type ReceiptProjectStage = (typeof RECEIPT_PROJECT_STAGES)[number];

export const RECEIPT_PROJECT_PAYMENT_TERMS = [
  "FULL_BEFORE_INSTALLATION",
  "DEPOSIT_AND_BALANCE",
  "FULL_AFTER_INSTALLATION",
] as const;

export type ReceiptProjectPaymentTerm = (typeof RECEIPT_PROJECT_PAYMENT_TERMS)[number];

export const RECEIPT_PROJECT_PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "FULLY_PAID",
] as const;

export type ReceiptProjectPaymentStatus = (typeof RECEIPT_PROJECT_PAYMENT_STATUSES)[number];

export const RECEIPT_PROJECT_HANDLER_TYPES = [
  "STAFF",
  "EXTERNAL",
] as const;

export type ReceiptProjectHandlerType = (typeof RECEIPT_PROJECT_HANDLER_TYPES)[number];

export type ReceiptProjectFlow = {
  isProject: true;
  stage: ReceiptProjectStage;
  paymentTerm: ReceiptProjectPaymentTerm;
  paymentStatus: ReceiptProjectPaymentStatus;
  projectValue: number;
  depositPercent: number;
  depositRequiredAmount: number;
  amountPaidTotal: number;
  balanceAmount: number;
  scheduledDate: string | null;
  postedReceiptNumber: string | null;
  internalNotes: string | null;
  handlerType: ReceiptProjectHandlerType | null;
  handlerStaffId: string | null;
  handlerStaffName: string | null;
  externalAgentName: string | null;
  externalAgentPhone: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function roundCurrency(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function normalizeReceiptProjectStage(value: unknown): ReceiptProjectStage {
  const candidate = String(value || "").trim().toUpperCase();
  if (RECEIPT_PROJECT_STAGES.includes(candidate as ReceiptProjectStage)) {
    return candidate as ReceiptProjectStage;
  }
  return "RECEIPT_CREATED";
}

export function normalizeReceiptProjectPaymentTerm(value: unknown): ReceiptProjectPaymentTerm {
  const candidate = String(value || "").trim().toUpperCase();
  if (RECEIPT_PROJECT_PAYMENT_TERMS.includes(candidate as ReceiptProjectPaymentTerm)) {
    return candidate as ReceiptProjectPaymentTerm;
  }
  return "DEPOSIT_AND_BALANCE";
}

export function normalizeReceiptProjectPaymentStatus(value: unknown): ReceiptProjectPaymentStatus {
  const candidate = String(value || "").trim().toUpperCase();
  if (RECEIPT_PROJECT_PAYMENT_STATUSES.includes(candidate as ReceiptProjectPaymentStatus)) {
    return candidate as ReceiptProjectPaymentStatus;
  }
  return "UNPAID";
}

export function normalizeReceiptProjectHandlerType(value: unknown): ReceiptProjectHandlerType | null {
  const candidate = String(value || "").trim().toUpperCase();
  if (RECEIPT_PROJECT_HANDLER_TYPES.includes(candidate as ReceiptProjectHandlerType)) {
    return candidate as ReceiptProjectHandlerType;
  }
  return null;
}

function normalizeOptionalDate(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function buildReceiptProjectFlow(input: {
  existing?: Record<string, unknown> | null;
  stage?: unknown;
  paymentTerm?: unknown;
  projectValue: number;
  amountPaidTotal: number;
  depositPercent?: unknown;
  scheduledDate?: unknown;
  postedReceiptNumber?: unknown;
  internalNotes?: unknown;
  handlerType?: unknown;
  handlerStaffId?: unknown;
  handlerStaffName?: unknown;
  externalAgentName?: unknown;
  externalAgentPhone?: unknown;
}) {
  const existing = input.existing ?? null;
  const projectValue = roundCurrency(Math.max(0, Number(input.projectValue || 0)));
  const amountPaidTotal = roundCurrency(
    Math.max(0, Math.min(projectValue, Number(input.amountPaidTotal || 0))),
  );
  const paymentTerm = normalizeReceiptProjectPaymentTerm(
    input.paymentTerm ?? existing?.paymentTerm,
  );
  const rawDepositPercent = Number(input.depositPercent ?? existing?.depositPercent ?? 30);
  const depositPercent =
    paymentTerm === "DEPOSIT_AND_BALANCE"
      ? Math.max(0, Math.min(100, Number.isFinite(rawDepositPercent) ? rawDepositPercent : 30))
      : 0;
  const depositRequiredAmount =
    paymentTerm === "DEPOSIT_AND_BALANCE"
      ? roundCurrency(projectValue * (depositPercent / 100))
      : 0;
  const balanceAmount = roundCurrency(Math.max(0, projectValue - amountPaidTotal));
  const handlerType = normalizeReceiptProjectHandlerType(
    input.handlerType ?? existing?.handlerType,
  );
  const handlerStaffId =
    handlerType === "STAFF"
      ? String(input.handlerStaffId ?? existing?.handlerStaffId ?? "").trim() || null
      : null;
  const handlerStaffName =
    handlerType === "STAFF"
      ? String(input.handlerStaffName ?? existing?.handlerStaffName ?? "").trim() || null
      : null;
  const externalAgentName =
    handlerType === "EXTERNAL"
      ? String(input.externalAgentName ?? existing?.externalAgentName ?? "").trim() || null
      : null;
  const externalAgentPhone =
    handlerType === "EXTERNAL"
      ? String(input.externalAgentPhone ?? existing?.externalAgentPhone ?? "").trim() || null
      : null;

  let paymentStatus: ReceiptProjectPaymentStatus = "UNPAID";
  if (amountPaidTotal >= projectValue && projectValue > 0) {
    paymentStatus = "FULLY_PAID";
  } else if (amountPaidTotal > 0) {
    paymentStatus = "PARTIALLY_PAID";
  }

  return {
    isProject: true as const,
    stage: normalizeReceiptProjectStage(input.stage ?? existing?.stage),
    paymentTerm,
    paymentStatus,
    projectValue,
    depositPercent,
    depositRequiredAmount,
    amountPaidTotal,
    balanceAmount,
    scheduledDate: normalizeOptionalDate(input.scheduledDate ?? existing?.scheduledDate),
    postedReceiptNumber: String(
      input.postedReceiptNumber ?? existing?.postedReceiptNumber ?? "",
    ).trim() || null,
    internalNotes:
      String(input.internalNotes ?? existing?.internalNotes ?? "").trim() || null,
    handlerType,
    handlerStaffId,
    handlerStaffName,
    externalAgentName,
    externalAgentPhone,
    createdAt:
      String(existing?.createdAt ?? "").trim() || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies ReceiptProjectFlow;
}

export function readReceiptProjectFlow(value: unknown): ReceiptProjectFlow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.isProject !== true) return null;
  return {
    isProject: true,
    stage: normalizeReceiptProjectStage(source.stage),
    paymentTerm: normalizeReceiptProjectPaymentTerm(source.paymentTerm),
    paymentStatus: normalizeReceiptProjectPaymentStatus(source.paymentStatus),
    projectValue: roundCurrency(Math.max(0, Number(source.projectValue || 0))),
    depositPercent: Math.max(0, Number(source.depositPercent || 0)),
    depositRequiredAmount: roundCurrency(Math.max(0, Number(source.depositRequiredAmount || 0))),
    amountPaidTotal: roundCurrency(Math.max(0, Number(source.amountPaidTotal || 0))),
    balanceAmount: roundCurrency(Math.max(0, Number(source.balanceAmount || 0))),
    scheduledDate: normalizeOptionalDate(source.scheduledDate),
    postedReceiptNumber: String(source.postedReceiptNumber || "").trim() || null,
    internalNotes: String(source.internalNotes || "").trim() || null,
    handlerType: normalizeReceiptProjectHandlerType(source.handlerType),
    handlerStaffId: String(source.handlerStaffId || "").trim() || null,
    handlerStaffName: String(source.handlerStaffName || "").trim() || null,
    externalAgentName: String(source.externalAgentName || "").trim() || null,
    externalAgentPhone: String(source.externalAgentPhone || "").trim() || null,
    createdAt: String(source.createdAt || "").trim() || null,
    updatedAt: String(source.updatedAt || "").trim() || null,
  };
}
