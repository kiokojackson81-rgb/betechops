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

export type ReceiptProjectHandlerAssignment = {
  kind: ReceiptProjectHandlerType;
  staffId: string | null;
  staffName: string | null;
  externalAgentId: string | null;
  externalAgentName: string | null;
  phone: string | null;
};

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
  handlerStaffIds: string[];
  externalAgentId: string | null;
  externalAgentName: string | null;
  externalAgentIds: string[];
  externalAgentPhone: string | null;
  assignedHandlers: ReceiptProjectHandlerAssignment[];
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

function toTrimmedString(value: unknown) {
  return String(value || "").trim();
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => toTrimmedString(entry))
        .filter(Boolean),
    ),
  );
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

function normalizeAssignedHandlers(value: unknown): ReceiptProjectHandlerAssignment[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  const normalized: ReceiptProjectHandlerAssignment[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const kind = normalizeReceiptProjectHandlerType(record.kind);
    if (!kind) continue;
    const item = {
      kind,
      staffId: kind === "STAFF" ? toTrimmedString(record.staffId) || null : null,
      staffName: kind === "STAFF" ? toTrimmedString(record.staffName) || null : null,
      externalAgentId: kind === "EXTERNAL" ? toTrimmedString(record.externalAgentId) || null : null,
      externalAgentName: kind === "EXTERNAL" ? toTrimmedString(record.externalAgentName) || null : null,
      phone: toTrimmedString(record.phone) || null,
    } satisfies ReceiptProjectHandlerAssignment;
    const key = JSON.stringify(item);
    if (unique.has(key)) continue;
    unique.add(key);
    normalized.push(item);
  }

  return normalized;
}

function buildLegacyAssignedHandlers(source: {
  handlerType: ReceiptProjectHandlerType | null;
  handlerStaffId: string | null;
  handlerStaffName: string | null;
  externalAgentId: string | null;
  externalAgentName: string | null;
  externalAgentPhone: string | null;
}) {
  if (source.handlerType === "STAFF" && (source.handlerStaffId || source.handlerStaffName)) {
    return [
      {
        kind: "STAFF" as const,
        staffId: source.handlerStaffId,
        staffName: source.handlerStaffName,
        externalAgentId: null,
        externalAgentName: null,
        phone: null,
      },
    ];
  }

  if (source.handlerType === "EXTERNAL" && (source.externalAgentId || source.externalAgentName || source.externalAgentPhone)) {
    return [
      {
        kind: "EXTERNAL" as const,
        staffId: null,
        staffName: null,
        externalAgentId: source.externalAgentId,
        externalAgentName: source.externalAgentName,
        phone: source.externalAgentPhone,
      },
    ];
  }

  return [];
}

function looksLikeLegacyProjectFlow(source: Record<string, unknown>) {
  const markerKeys = [
    "stage",
    "paymentTerm",
    "paymentStatus",
    "depositType",
    "depositValue",
    "depositPercent",
    "depositRequiredAmount",
    "depositPaidAmount",
    "balanceExpectedAmount",
    "balancePaidAmount",
    "totalPaidAmount",
    "amountPaidTotal",
    "remainingAmount",
    "balanceAmount",
    "scheduledDate",
    "postedReceiptNumber",
    "handlerType",
    "handlerStaffId",
    "handlerStaffIds",
    "handlerStaffName",
    "externalAgentId",
    "externalAgentName",
    "externalAgentIds",
    "externalAgentPhone",
    "assignedHandlers",
  ] as const;

  return markerKeys.some((key) => hasMeaningfulValue(source[key]));
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
  handlerStaffIds?: unknown;
  externalAgentId?: unknown;
  externalAgentName?: unknown;
  externalAgentIds?: unknown;
  externalAgentPhone?: unknown;
  assignedHandlers?: unknown;
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
        ? roundCurrency(
            Math.max(
              0,
              Math.min(projectValue, Number.isFinite(normalizedDepositValue) ? normalizedDepositValue : 0),
            ),
          )
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
        Number(input.amountPaidTotal ?? depositPaidAmount + balancePaidAmount) || 0,
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
  const requestedHandlerType = normalizeReceiptProjectHandlerType(
    input.handlerType ?? existing?.handlerType,
  );

  const requestedAssignments = normalizeAssignedHandlers(
    input.assignedHandlers ?? existing?.assignedHandlers,
  );
  const legacyHandlerStaffId = toTrimmedString(input.handlerStaffId ?? existing?.handlerStaffId) || null;
  const legacyHandlerStaffName = toTrimmedString(input.handlerStaffName ?? existing?.handlerStaffName) || null;
  const legacyExternalAgentId = toTrimmedString(input.externalAgentId ?? existing?.externalAgentId) || null;
  const legacyExternalAgentName = toTrimmedString(input.externalAgentName ?? existing?.externalAgentName) || null;
  const legacyExternalAgentPhone = toTrimmedString(input.externalAgentPhone ?? existing?.externalAgentPhone) || null;

  const assignedHandlers =
    requestedAssignments.length > 0
      ? requestedAssignments
      : buildLegacyAssignedHandlers({
          handlerType: requestedHandlerType,
          handlerStaffId: legacyHandlerStaffId,
          handlerStaffName: legacyHandlerStaffName,
          externalAgentId: legacyExternalAgentId,
          externalAgentName: legacyExternalAgentName,
          externalAgentPhone: legacyExternalAgentPhone,
        });

  const primaryAssignment = assignedHandlers[0] ?? null;
  const handlerStaffIds = assignedHandlers
    .filter((entry) => entry.kind === "STAFF" && entry.staffId)
    .map((entry) => entry.staffId as string);
  const externalAgentIds = assignedHandlers
    .filter((entry) => entry.kind === "EXTERNAL" && entry.externalAgentId)
    .map((entry) => entry.externalAgentId as string);
  const normalizedHandlerType =
    assignedHandlers.length === 0
      ? null
      : assignedHandlers.every((entry) => entry.kind === "STAFF")
        ? "STAFF"
        : assignedHandlers.every((entry) => entry.kind === "EXTERNAL")
          ? "EXTERNAL"
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
    depositReference: toTrimmedString(input.depositReference ?? existing?.depositReference) || null,
    balanceExpectedAmount,
    balancePaidAmount,
    balancePendingAmount,
    balancePaymentMethod,
    balanceReference: toTrimmedString(input.balanceReference ?? existing?.balanceReference) || null,
    totalPaidAmount,
    remainingAmount,
    amountPaidTotal,
    balanceAmount,
    scheduledDate: normalizeOptionalDate(input.scheduledDate ?? existing?.scheduledDate),
    postedReceiptNumber: toTrimmedString(input.postedReceiptNumber ?? existing?.postedReceiptNumber) || null,
    internalNotes: toTrimmedString(input.internalNotes ?? existing?.internalNotes) || null,
    paymentNotes: toTrimmedString(input.paymentNotes ?? existing?.paymentNotes) || null,
    handlerType: normalizedHandlerType,
    handlerStaffId: primaryAssignment?.kind === "STAFF" ? primaryAssignment.staffId : null,
    handlerStaffName: primaryAssignment?.kind === "STAFF" ? primaryAssignment.staffName : null,
    handlerStaffIds,
    externalAgentId: primaryAssignment?.kind === "EXTERNAL" ? primaryAssignment.externalAgentId : null,
    externalAgentName: primaryAssignment?.kind === "EXTERNAL" ? primaryAssignment.externalAgentName : null,
    externalAgentIds,
    externalAgentPhone: primaryAssignment?.kind === "EXTERNAL" ? primaryAssignment.phone : null,
    assignedHandlers,
    createdAt: toTrimmedString(existing?.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies ReceiptProjectFlow;
}

export function readReceiptProjectFlow(value: unknown): ReceiptProjectFlow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const isExplicitProject = source.isProject === true;
  const isLegacyProject = !isExplicitProject && looksLikeLegacyProjectFlow(source);
  if (!isExplicitProject && !isLegacyProject) return null;
  const projectValue = roundCurrency(Math.max(0, Number(source.projectValue || 0)));
  const depositType = normalizeReceiptProjectDepositType(source.depositType);
  const depositValue = roundCurrency(Math.max(0, Number(source.depositValue || 0)));
  const depositPercent = Math.max(0, Number(source.depositPercent || 0));
  const depositRequiredAmount = roundCurrency(Math.max(0, Number(source.depositRequiredAmount || 0)));
  const depositPaidAmount = roundCurrency(Math.max(0, Number(source.depositPaidAmount || 0)));
  let depositPendingAmount = roundCurrency(Math.max(0, Number(source.depositPendingAmount || 0)));
  const balanceExpectedAmount = roundCurrency(Math.max(0, Number(source.balanceExpectedAmount || 0)));
  const balancePaidAmount = roundCurrency(Math.max(0, Number(source.balancePaidAmount || 0)));
  let balancePendingAmount = roundCurrency(Math.max(0, Number(source.balancePendingAmount || 0)));
  let totalPaidAmount = roundCurrency(Math.max(0, Number(source.totalPaidAmount || source.amountPaidTotal || 0)));
  let remainingAmount = roundCurrency(
    Math.max(0, Number(source.remainingAmount || source.balanceAmount || Math.max(0, projectValue - totalPaidAmount))),
  );
  let amountPaidTotal = roundCurrency(Math.max(0, Number(source.amountPaidTotal || totalPaidAmount || 0)));
  let balanceAmount = roundCurrency(Math.max(0, Number(source.balanceAmount || remainingAmount || 0)));
  const postedReceiptNumber = toTrimmedString(source.postedReceiptNumber) || null;
  const scheduledDate = normalizeOptionalDate(source.scheduledDate);
  const handlerType = normalizeReceiptProjectHandlerType(source.handlerType);
  const handlerStaffId = toTrimmedString(source.handlerStaffId) || null;
  const handlerStaffName = toTrimmedString(source.handlerStaffName) || null;
  const handlerStaffIds = toStringArray(source.handlerStaffIds);
  const externalAgentId = toTrimmedString(source.externalAgentId) || null;
  const externalAgentName = toTrimmedString(source.externalAgentName) || null;
  const externalAgentIds = toStringArray(source.externalAgentIds);
  const externalAgentPhone = toTrimmedString(source.externalAgentPhone) || null;
  const explicitAssignedHandlers = normalizeAssignedHandlers(source.assignedHandlers);
  const assignedHandlers =
    explicitAssignedHandlers.length > 0
      ? explicitAssignedHandlers
      : buildLegacyAssignedHandlers({
          handlerType,
          handlerStaffId,
          handlerStaffName,
          externalAgentId,
          externalAgentName,
          externalAgentPhone,
        });

  const hasExplicitStage = RECEIPT_PROJECT_STAGES.includes(
    String(source.stage || "").trim().toUpperCase() as ReceiptProjectStage,
  );
  const hasExplicitPaymentStatus = RECEIPT_PROJECT_PAYMENT_STATUSES.includes(
    String(source.paymentStatus || "").trim().toUpperCase() as ReceiptProjectPaymentStatus,
  );

  let derivedPaymentStatus: ReceiptProjectPaymentStatus =
    totalPaidAmount >= projectValue && projectValue > 0
      ? "FULLY_PAID"
      : totalPaidAmount > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

  const looksCompletedLegacy =
    Boolean(postedReceiptNumber) ||
    (projectValue > 0 && totalPaidAmount >= projectValue) ||
    (projectValue > 0 && remainingAmount <= 0);
  const looksInProgressLegacy =
    Boolean(scheduledDate) ||
    Boolean(handlerStaffId) ||
    handlerStaffIds.length > 0 ||
    Boolean(handlerStaffName) ||
    Boolean(externalAgentId) ||
    Boolean(externalAgentName) ||
    externalAgentIds.length > 0 ||
    Boolean(externalAgentPhone) ||
    assignedHandlers.length > 0 ||
    handlerType !== null;
  const stage = hasExplicitStage
    ? normalizeReceiptProjectStage(source.stage)
    : looksCompletedLegacy
      ? "COMPLETED_POSTED"
      : looksInProgressLegacy
        ? "PROJECT_IN_PROGRESS"
        : "RECEIPT_CREATED";

  if (stage === "COMPLETED_POSTED") {
    if (projectValue > 0) {
      totalPaidAmount = projectValue;
      amountPaidTotal = projectValue;
      remainingAmount = 0;
      balanceAmount = 0;
      depositPendingAmount = 0;
      balancePendingAmount = 0;
    }
    derivedPaymentStatus = "FULLY_PAID";
  }

  const paymentStatus =
    stage === "COMPLETED_POSTED"
      ? "FULLY_PAID"
      : hasExplicitPaymentStatus
        ? normalizeReceiptProjectPaymentStatus(source.paymentStatus)
        : derivedPaymentStatus;
  const primaryAssignment = assignedHandlers[0] ?? null;
  const normalizedHandlerType =
    assignedHandlers.length === 0
      ? handlerType
      : assignedHandlers.every((entry) => entry.kind === "STAFF")
        ? "STAFF"
        : assignedHandlers.every((entry) => entry.kind === "EXTERNAL")
          ? "EXTERNAL"
          : null;

  return {
    isProject: true,
    stage,
    paymentTerm: normalizeReceiptProjectPaymentTerm(source.paymentTerm),
    paymentStatus,
    projectValue,
    depositType,
    depositValue,
    depositPercent,
    depositRequiredAmount,
    depositPaidAmount,
    depositPendingAmount,
    depositPaymentMethod: normalizeReceiptProjectPaymentMethod(source.depositPaymentMethod),
    depositReference: toTrimmedString(source.depositReference) || null,
    balanceExpectedAmount,
    balancePaidAmount,
    balancePendingAmount,
    balancePaymentMethod: normalizeReceiptProjectPaymentMethod(source.balancePaymentMethod),
    balanceReference: toTrimmedString(source.balanceReference) || null,
    totalPaidAmount,
    remainingAmount,
    amountPaidTotal,
    balanceAmount,
    scheduledDate,
    postedReceiptNumber,
    internalNotes: toTrimmedString(source.internalNotes) || null,
    paymentNotes: toTrimmedString(source.paymentNotes) || null,
    handlerType: normalizedHandlerType,
    handlerStaffId: primaryAssignment?.kind === "STAFF" ? primaryAssignment.staffId : handlerStaffId,
    handlerStaffName: primaryAssignment?.kind === "STAFF" ? primaryAssignment.staffName : handlerStaffName,
    handlerStaffIds:
      handlerStaffIds.length > 0
        ? handlerStaffIds
        : assignedHandlers
            .filter((entry) => entry.kind === "STAFF" && entry.staffId)
            .map((entry) => entry.staffId as string),
    externalAgentId: primaryAssignment?.kind === "EXTERNAL" ? primaryAssignment.externalAgentId : externalAgentId,
    externalAgentName: primaryAssignment?.kind === "EXTERNAL" ? primaryAssignment.externalAgentName : externalAgentName,
    externalAgentIds:
      externalAgentIds.length > 0
        ? externalAgentIds
        : assignedHandlers
            .filter((entry) => entry.kind === "EXTERNAL" && entry.externalAgentId)
            .map((entry) => entry.externalAgentId as string),
    externalAgentPhone: primaryAssignment?.kind === "EXTERNAL" ? primaryAssignment.phone : externalAgentPhone,
    assignedHandlers,
    createdAt: toTrimmedString(source.createdAt) || null,
    updatedAt: toTrimmedString(source.updatedAt) || null,
  };
}

export function isReceiptProjectRecognizedForSales(value: unknown): boolean {
  const flow = readReceiptProjectFlow(value);
  if (!flow?.isProject) return false;
  return flow.stage === "COMPLETED_POSTED" && flow.paymentStatus === "FULLY_PAID";
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
  if (!isReceiptProjectRecognizedForSales(value)) return null;
  const flow = readReceiptProjectFlow(value);
  if (!flow) return null;
  return (
    normalizeOptionalDateObject(flow.updatedAt) ??
    normalizeOptionalDateObject(fallbackUpdatedAt) ??
    normalizeOptionalDateObject(fallbackCreatedAt)
  );
}
