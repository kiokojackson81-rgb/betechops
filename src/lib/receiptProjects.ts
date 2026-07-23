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

export const RECEIPT_PROJECT_DEPOSIT_TYPES = [
  "PERCENT",
  "AMOUNT",
] as const;

export type ReceiptProjectDepositType = (typeof RECEIPT_PROJECT_DEPOSIT_TYPES)[number];

export const RECEIPT_PROJECT_PAYMENT_METHODS = [
  "MPESA",
  "CASH",
  "BANK",
  "MIXED",
  "UNSPECIFIED",
] as const;

export type ReceiptProjectPaymentMethod = (typeof RECEIPT_PROJECT_PAYMENT_METHODS)[number];

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
  depositType: ReceiptProjectDepositType;
  depositValue: number;
  depositPercent: number;
  depositRequiredAmount: number;
  depositPaidAmount: number;
  depositPendingAmount: number;
  depositPaymentMethod: ReceiptProjectPaymentMethod;
  depositReference: string | null;
  balanceExpectedAmount: number;
  balancePaidAmount: number;
  balancePendingAmount: number;
  balancePaymentMethod: ReceiptProjectPaymentMethod;
  balanceReference: string | null;
  totalPaidAmount: number;
  remainingAmount: number;
  amountPaidTotal: number;
  balanceAmount: number;
  scheduledDate: string | null;
  postedReceiptNumber: string | null;
  internalNotes: string | null;
  paymentNotes: string | null;
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

function hasMeaningfulValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
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

export function normalizeReceiptProjectDepositType(value: unknown): ReceiptProjectDepositType {
  const candidate = String(value || "").trim().toUpperCase();
  if (RECEIPT_PROJECT_DEPOSIT_TYPES.includes(candidate as ReceiptProjectDepositType)) {
    return candidate as ReceiptProjectDepositType;
  }
  return "PERCENT";
}

export function normalizeReceiptProjectHandlerType(value: unknown): ReceiptProjectHandlerType | null {
  const candidate = String(value || "").trim().toUpperCase();
  if (RECEIPT_PROJECT_HANDLER_TYPES.includes(candidate as ReceiptProjectHandlerType)) {
    return candidate as ReceiptProjectHandlerType;
  }
  return null;
}

export function normalizeReceiptProjectPaymentMethod(value: unknown): ReceiptProjectPaymentMethod {
  const candidate = String(value || "").trim().toUpperCase();
  if (RECEIPT_PROJECT_PAYMENT_METHODS.includes(candidate as ReceiptProjectPaymentMethod)) {
    return candidate as ReceiptProjectPaymentMethod;
  }
  return "UNSPECIFIED";
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
  depositType?: unknown;
  depositValue?: unknown;
  projectValue: number;
  depositPercent?: unknown;
  depositAmount?: unknown;
  depositPaidAmount?: unknown;
  depositPaymentMethod?: unknown;
  depositReference?: unknown;
  balancePaidAmount?: unknown;
  balancePaymentMethod?: unknown;
  balanceReference?: unknown;
  amountPaidTotal?: number;
  scheduledDate?: unknown;
  postedReceiptNumber?: unknown;
  internalNotes?: unknown;
  paymentNotes?: unknown;
  handlerType?: unknown;
  handlerStaffId?: unknown;
  handlerStaffName?: unknown;
  externalAgentName?: unknown;
  externalAgentPhone?: unknown;
}) {
  const existing = input.existing ?? null;
  const projectValue = roundCurrency(Math.max(0, Number(input.projectValue || 0)));
  const stage = normalizeReceiptProjectStage(input.stage ?? existing?.stage);
  const paymentTerm = normalizeReceiptProjectPaymentTerm(
    input.paymentTerm ?? existing?.paymentTerm,
  );
  const depositType =
    paymentTerm === "DEPOSIT_AND_BALANCE"
      ? normalizeReceiptProjectDepositType(input.depositType ?? existing?.depositType)
      : "PERCENT";
  const rawDepositValue =
    input.depositValue ??
    (depositType === "AMOUNT"
      ? input.depositAmount ?? existing?.depositValue ?? existing?.depositRequiredAmount
      : input.depositPercent ?? existing?.depositValue ?? existing?.depositPercent ?? 30);
  const normalizedDepositValue = Number(rawDepositValue);
  const depositValue =
    paymentTerm === "DEPOSIT_AND_BALANCE"
      ? depositType === "AMOUNT"
        ? roundCurrency(Math.max(0, Math.min(projectValue, Number.isFinite(normalizedDepositValue) ? normalizedDepositValue : 0)))
        : Math.max(0, Math.min(100, Number.isFinite(normalizedDepositValue) ? normalizedDepositValue : 30))
      : paymentTerm === "FULL_BEFORE_INSTALLATION"
        ? projectValue
        : 0;
  const depositRequiredAmount =
    paymentTerm === "FULL_BEFORE_INSTALLATION"
      ? projectValue
      : paymentTerm === "DEPOSIT_AND_BALANCE"
        ? depositType === "AMOUNT"
          ? roundCurrency(depositValue)
          : roundCurrency(projectValue * (depositValue / 100))
        : 0;
  const depositPercent =
    paymentTerm === "DEPOSIT_AND_BALANCE"
      ? projectValue > 0
        ? roundCurrency((depositRequiredAmount / projectValue) * 100)
        : 0
      : 0;
  const balanceExpectedAmount =
    paymentTerm === "FULL_BEFORE_INSTALLATION"
      ? 0
      : paymentTerm === "FULL_AFTER_INSTALLATION"
        ? projectValue
        : roundCurrency(Math.max(0, projectValue - depositRequiredAmount));
  const shouldAssumeDepositWasPaid =
    paymentTerm === "DEPOSIT_AND_BALANCE" &&
    !hasMeaningfulValue(input.depositPaidAmount) &&
    !hasMeaningfulValue(existing?.depositPaidAmount);
  const depositPaidAmount = roundCurrency(
    Math.max(
      0,
      Math.min(
        projectValue,
        Number(
          shouldAssumeDepositWasPaid
            ? depositRequiredAmount
            : input.depositPaidAmount ?? existing?.depositPaidAmount ?? 0,
        ) || 0,
      ),
    ),
  );
  const balancePaidAmount = roundCurrency(
    Math.max(0, Math.min(projectValue, Number(input.balancePaidAmount ?? existing?.balancePaidAmount ?? 0))),
  );
  let totalPaidAmount = roundCurrency(
    Math.max(
      0,
      Math.min(
        projectValue,
        Number(
          input.amountPaidTotal ??
            (depositPaidAmount + balancePaidAmount),
        ) || 0,
      ),
    ),
  );
  if (stage === "COMPLETED_POSTED" && projectValue > 0) {
    totalPaidAmount = projectValue;
  }
  const depositPendingAmount = roundCurrency(
    stage === "COMPLETED_POSTED" ? 0 : Math.max(0, depositRequiredAmount - depositPaidAmount),
  );
  const balancePendingAmount = roundCurrency(
    stage === "COMPLETED_POSTED" ? 0 : Math.max(0, balanceExpectedAmount - balancePaidAmount),
  );
  const remainingAmount = roundCurrency(Math.max(0, projectValue - totalPaidAmount));
  const amountPaidTotal = totalPaidAmount;
  const balanceAmount = remainingAmount;
  const depositPaymentMethod = normalizeReceiptProjectPaymentMethod(
    input.depositPaymentMethod ?? existing?.depositPaymentMethod,
  );
  const balancePaymentMethod = normalizeReceiptProjectPaymentMethod(
    input.balancePaymentMethod ?? existing?.balancePaymentMethod,
  );
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
    stage,
    paymentTerm,
    paymentStatus,
    projectValue,
    depositType,
    depositValue,
    depositPercent,
    depositRequiredAmount,
    depositPaidAmount,
    depositPendingAmount,
    depositPaymentMethod,
    depositReference: String(input.depositReference ?? existing?.depositReference ?? "").trim() || null,
    balanceExpectedAmount,
    balancePaidAmount,
    balancePendingAmount,
    balancePaymentMethod,
    balanceReference: String(input.balanceReference ?? existing?.balanceReference ?? "").trim() || null,
    totalPaidAmount,
    remainingAmount,
    amountPaidTotal,
    balanceAmount,
    scheduledDate: normalizeOptionalDate(input.scheduledDate ?? existing?.scheduledDate),
    postedReceiptNumber: String(
      input.postedReceiptNumber ?? existing?.postedReceiptNumber ?? "",
    ).trim() || null,
    internalNotes:
      String(input.internalNotes ?? existing?.internalNotes ?? "").trim() || null,
    paymentNotes:
      String(input.paymentNotes ?? existing?.paymentNotes ?? "").trim() || null,
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
    depositType: normalizeReceiptProjectDepositType(source.depositType),
    depositValue: roundCurrency(Math.max(0, Number(source.depositValue || 0))),
    depositPercent: Math.max(0, Number(source.depositPercent || 0)),
    depositRequiredAmount: roundCurrency(Math.max(0, Number(source.depositRequiredAmount || 0))),
    depositPaidAmount: roundCurrency(Math.max(0, Number(source.depositPaidAmount || 0))),
    depositPendingAmount: roundCurrency(Math.max(0, Number(source.depositPendingAmount || 0))),
    depositPaymentMethod: normalizeReceiptProjectPaymentMethod(source.depositPaymentMethod),
    depositReference: String(source.depositReference || "").trim() || null,
    balanceExpectedAmount: roundCurrency(Math.max(0, Number(source.balanceExpectedAmount || 0))),
    balancePaidAmount: roundCurrency(Math.max(0, Number(source.balancePaidAmount || 0))),
    balancePendingAmount: roundCurrency(Math.max(0, Number(source.balancePendingAmount || 0))),
    balancePaymentMethod: normalizeReceiptProjectPaymentMethod(source.balancePaymentMethod),
    balanceReference: String(source.balanceReference || "").trim() || null,
    totalPaidAmount: roundCurrency(Math.max(0, Number(source.totalPaidAmount || source.amountPaidTotal || 0))),
    remainingAmount: roundCurrency(Math.max(0, Number(source.remainingAmount || source.balanceAmount || 0))),
    amountPaidTotal: roundCurrency(Math.max(0, Number(source.amountPaidTotal || 0))),
    balanceAmount: roundCurrency(Math.max(0, Number(source.balanceAmount || 0))),
    scheduledDate: normalizeOptionalDate(source.scheduledDate),
    postedReceiptNumber: String(source.postedReceiptNumber || "").trim() || null,
    internalNotes: String(source.internalNotes || "").trim() || null,
    paymentNotes: String(source.paymentNotes || "").trim() || null,
    handlerType: normalizeReceiptProjectHandlerType(source.handlerType),
    handlerStaffId: String(source.handlerStaffId || "").trim() || null,
    handlerStaffName: String(source.handlerStaffName || "").trim() || null,
    externalAgentName: String(source.externalAgentName || "").trim() || null,
    externalAgentPhone: String(source.externalAgentPhone || "").trim() || null,
    createdAt: String(source.createdAt || "").trim() || null,
    updatedAt: String(source.updatedAt || "").trim() || null,
  };
}

function normalizeOptionalDateObject(value: unknown): Date | null {
  const candidate = String(value || "").trim();
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getReceiptProjectCompletionDate(
  value: unknown,
  fallbackUpdatedAt?: unknown,
  fallbackCreatedAt?: unknown,
): Date | null {
  const flow = readReceiptProjectFlow(value);
  if (!flow?.isProject || flow.stage !== "COMPLETED_POSTED") return null;
  return (
    normalizeOptionalDateObject(flow.updatedAt) ??
    normalizeOptionalDateObject(fallbackUpdatedAt) ??
    normalizeOptionalDateObject(fallbackCreatedAt)
  );
}
