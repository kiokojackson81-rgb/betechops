import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureQuoteRequestsSchema } from "@/lib/quoteRequests";

export const QUOTE_PROJECT_STAGES = [
  "RECEIPT_CREATED",
  "PROJECT_IN_PROGRESS",
  "COMPLETED_POSTED",
] as const;

export type QuoteProjectStage = (typeof QUOTE_PROJECT_STAGES)[number];

export const QUOTE_PROJECT_PAYMENT_TERMS = [
  "FULL_BEFORE_INSTALLATION",
  "DEPOSIT_AND_BALANCE",
  "FULL_AFTER_INSTALLATION",
] as const;

export type QuoteProjectPaymentTerm = (typeof QUOTE_PROJECT_PAYMENT_TERMS)[number];

export const QUOTE_PROJECT_PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "FULLY_PAID",
] as const;

export type QuoteProjectPaymentStatus = (typeof QUOTE_PROJECT_PAYMENT_STATUSES)[number];

const QUOTE_PROJECT_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS "QuoteProjectOrder" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'RECEIPT_CREATED',
    "paymentTerm" TEXT NOT NULL DEFAULT 'DEPOSIT_AND_BALANCE',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositPercent" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "depositRequiredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositPaidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaidTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scheduledDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "postedToPosAt" TIMESTAMP(3),
    "postedReceiptNumber" TEXT,
    "assignedStaffId" TEXT,
    "assignedStaffEmail" TEXT,
    "assignedStaffName" TEXT,
    "internalNotes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteProjectOrder_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "QuoteProjectOrder_quoteRequestId_key" ON "QuoteProjectOrder"("quoteRequestId")`,
  `CREATE INDEX IF NOT EXISTS "QuoteProjectOrder_stage_updatedAt_idx" ON "QuoteProjectOrder"("stage","updatedAt")`,
  `CREATE INDEX IF NOT EXISTS "QuoteProjectOrder_paymentStatus_updatedAt_idx" ON "QuoteProjectOrder"("paymentStatus","updatedAt")`,
  `CREATE TABLE IF NOT EXISTS "QuoteProjectEvent" (
    "id" TEXT NOT NULL,
    "projectOrderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventLabel" TEXT NOT NULL,
    "eventDetail" TEXT,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteProjectEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "QuoteProjectEvent_projectOrderId_createdAt_idx" ON "QuoteProjectEvent"("projectOrderId","createdAt")`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuoteProjectOrder_quoteRequestId_fkey'
        AND table_name = 'QuoteProjectOrder'
    ) THEN
      ALTER TABLE "QuoteProjectOrder"
        ADD CONSTRAINT "QuoteProjectOrder_quoteRequestId_fkey"
        FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuoteProjectOrder_assignedStaffId_fkey'
        AND table_name = 'QuoteProjectOrder'
    ) THEN
      ALTER TABLE "QuoteProjectOrder"
        ADD CONSTRAINT "QuoteProjectOrder_assignedStaffId_fkey"
        FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuoteProjectOrder_createdById_fkey'
        AND table_name = 'QuoteProjectOrder'
    ) THEN
      ALTER TABLE "QuoteProjectOrder"
        ADD CONSTRAINT "QuoteProjectOrder_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuoteProjectOrder_updatedById_fkey'
        AND table_name = 'QuoteProjectOrder'
    ) THEN
      ALTER TABLE "QuoteProjectOrder"
        ADD CONSTRAINT "QuoteProjectOrder_updatedById_fkey"
        FOREIGN KEY ("updatedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuoteProjectEvent_projectOrderId_fkey'
        AND table_name = 'QuoteProjectEvent'
    ) THEN
      ALTER TABLE "QuoteProjectEvent"
        ADD CONSTRAINT "QuoteProjectEvent_projectOrderId_fkey"
        FOREIGN KEY ("projectOrderId") REFERENCES "QuoteProjectOrder"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuoteProjectEvent_actorUserId_fkey'
        AND table_name = 'QuoteProjectEvent'
    ) THEN
      ALTER TABLE "QuoteProjectEvent"
        ADD CONSTRAINT "QuoteProjectEvent_actorUserId_fkey"
        FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,
] as const;

type QuoteProjectOrderRow = {
  id: string;
  quoteRequestId: string;
  stage: string;
  paymentTerm: string;
  paymentStatus: string;
  totalAmount: number;
  depositPercent: number;
  depositRequiredAmount: number;
  depositPaidAmount: number;
  amountPaidTotal: number;
  balanceAmount: number;
  scheduledDate: Date | null;
  completedAt: Date | null;
  postedToPosAt: Date | null;
  postedReceiptNumber: string | null;
  assignedStaffId: string | null;
  assignedStaffEmail: string | null;
  assignedStaffName: string | null;
  internalNotes: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type QuoteProjectEventRow = {
  id: string;
  projectOrderId: string;
  eventType: string;
  eventLabel: string;
  eventDetail: string | null;
  actorUserId: string | null;
  actorName: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

const QUOTE_PROJECT_ORDER_SELECT_SQL = Prisma.sql`
  "id",
  "quoteRequestId",
  "stage",
  "paymentTerm",
  "paymentStatus",
  "totalAmount",
  "depositPercent",
  "depositRequiredAmount",
  "depositPaidAmount",
  "amountPaidTotal",
  "balanceAmount",
  "scheduledDate",
  "completedAt",
  "postedToPosAt",
  "postedReceiptNumber",
  "assignedStaffId",
  "assignedStaffEmail",
  "assignedStaffName",
  "internalNotes",
  "createdById",
  "updatedById",
  "createdAt",
  "updatedAt"
`;

const QUOTE_PROJECT_EVENT_SELECT_SQL = Prisma.sql`
  "id",
  "projectOrderId",
  "eventType",
  "eventLabel",
  "eventDetail",
  "actorUserId",
  "actorName",
  "metadata",
  "createdAt"
`;

function asJsonObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeProjectStage(value: unknown): QuoteProjectStage {
  const candidate = String(value || "").trim().toUpperCase();
  if (QUOTE_PROJECT_STAGES.includes(candidate as QuoteProjectStage)) {
    return candidate as QuoteProjectStage;
  }
  return "RECEIPT_CREATED";
}

function normalizePaymentTerm(value: unknown): QuoteProjectPaymentTerm {
  const candidate = String(value || "").trim().toUpperCase();
  if (QUOTE_PROJECT_PAYMENT_TERMS.includes(candidate as QuoteProjectPaymentTerm)) {
    return candidate as QuoteProjectPaymentTerm;
  }
  return "DEPOSIT_AND_BALANCE";
}

function normalizePaymentStatus(value: unknown): QuoteProjectPaymentStatus {
  const candidate = String(value || "").trim().toUpperCase();
  if (QUOTE_PROJECT_PAYMENT_STATUSES.includes(candidate as QuoteProjectPaymentStatus)) {
    return candidate as QuoteProjectPaymentStatus;
  }
  return "UNPAID";
}

export function roundProjectCurrency(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function computeQuoteProjectFinancials(input: {
  stage?: QuoteProjectStage | null;
  totalAmount: number;
  paymentTerm: QuoteProjectPaymentTerm;
  depositPercent?: number | null;
  depositRequiredAmount?: number | null;
  depositPaidAmount?: number | null;
  amountPaidTotal?: number | null;
}) {
  const totalAmount = roundProjectCurrency(Math.max(0, Number(input.totalAmount || 0)));
  const stage = input.stage ? normalizeProjectStage(input.stage) : "RECEIPT_CREATED";
  const paymentTerm = normalizePaymentTerm(input.paymentTerm);
  const rawDepositPercent = Number(input.depositPercent ?? 30);
  const depositPercent = paymentTerm === "DEPOSIT_AND_BALANCE"
    ? Math.min(100, Math.max(0, Number.isFinite(rawDepositPercent) ? rawDepositPercent : 30))
    : 0;

  const derivedDepositRequired =
    paymentTerm === "DEPOSIT_AND_BALANCE"
      ? roundProjectCurrency(totalAmount * (depositPercent / 100))
      : 0;

  const depositRequiredAmount = roundProjectCurrency(
    paymentTerm === "DEPOSIT_AND_BALANCE" && typeof input.depositRequiredAmount === "number" && Number.isFinite(input.depositRequiredAmount)
      ? Math.max(0, input.depositRequiredAmount)
      : derivedDepositRequired,
  );

  const depositPaidAmount = roundProjectCurrency(
    Math.min(totalAmount, Math.max(0, Number(input.depositPaidAmount || 0))),
  );
  let amountPaidTotal = roundProjectCurrency(
    Math.min(totalAmount, Math.max(depositPaidAmount, Number(input.amountPaidTotal || 0))),
  );
  if (stage === "COMPLETED_POSTED" && totalAmount > 0) {
    amountPaidTotal = totalAmount;
  }
  const balanceAmount = roundProjectCurrency(Math.max(0, totalAmount - amountPaidTotal));

  let paymentStatus: QuoteProjectPaymentStatus = "UNPAID";
  if (amountPaidTotal >= totalAmount && totalAmount > 0) {
    paymentStatus = "FULLY_PAID";
  } else if (amountPaidTotal > 0) {
    paymentStatus = "PARTIALLY_PAID";
  }

  return {
    totalAmount,
    stage,
    paymentTerm,
    paymentStatus,
    depositPercent,
    depositRequiredAmount,
    depositPaidAmount,
    amountPaidTotal,
    balanceAmount,
  };
}

export async function ensureQuoteProjectsSchema() {
  await ensureQuoteRequestsSchema();
  for (const statement of QUOTE_PROJECT_SCHEMA_SQL) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export type SerializedQuoteProjectOrder = {
  id: string;
  quoteRequestId: string;
  stage: QuoteProjectStage;
  paymentTerm: QuoteProjectPaymentTerm;
  paymentStatus: QuoteProjectPaymentStatus;
  totalAmount: number;
  depositPercent: number;
  depositRequiredAmount: number;
  depositPaidAmount: number;
  amountPaidTotal: number;
  balanceAmount: number;
  scheduledDate: string | null;
  completedAt: string | null;
  postedToPosAt: string | null;
  postedReceiptNumber: string | null;
  assignedStaffId: string | null;
  assignedStaffEmail: string | null;
  assignedStaffName: string | null;
  internalNotes: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedQuoteProjectEvent = {
  id: string;
  projectOrderId: string;
  eventType: string;
  eventLabel: string;
  eventDetail: string | null;
  actorUserId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

function serializeQuoteProjectOrder(row: QuoteProjectOrderRow): SerializedQuoteProjectOrder {
  return {
    id: row.id,
    quoteRequestId: row.quoteRequestId,
    stage: normalizeProjectStage(row.stage),
    paymentTerm: normalizePaymentTerm(row.paymentTerm),
    paymentStatus: normalizePaymentStatus(row.paymentStatus),
    totalAmount: Number(row.totalAmount ?? 0),
    depositPercent: Number(row.depositPercent ?? 0),
    depositRequiredAmount: Number(row.depositRequiredAmount ?? 0),
    depositPaidAmount: Number(row.depositPaidAmount ?? 0),
    amountPaidTotal: Number(row.amountPaidTotal ?? 0),
    balanceAmount: Number(row.balanceAmount ?? 0),
    scheduledDate: row.scheduledDate ? row.scheduledDate.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    postedToPosAt: row.postedToPosAt ? row.postedToPosAt.toISOString() : null,
    postedReceiptNumber: row.postedReceiptNumber ?? null,
    assignedStaffId: row.assignedStaffId ?? null,
    assignedStaffEmail: row.assignedStaffEmail ?? null,
    assignedStaffName: row.assignedStaffName ?? null,
    internalNotes: row.internalNotes ?? null,
    createdById: row.createdById ?? null,
    updatedById: row.updatedById ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeQuoteProjectEvent(row: QuoteProjectEventRow): SerializedQuoteProjectEvent {
  return {
    id: row.id,
    projectOrderId: row.projectOrderId,
    eventType: row.eventType,
    eventLabel: row.eventLabel,
    eventDetail: row.eventDetail ?? null,
    actorUserId: row.actorUserId ?? null,
    actorName: row.actorName ?? null,
    metadata: asJsonObject(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getQuoteProjectOrderByQuoteRequestId(quoteRequestId: string) {
  await ensureQuoteProjectsSchema();
  const rows = await prisma.$queryRaw<QuoteProjectOrderRow[]>(Prisma.sql`
    SELECT ${QUOTE_PROJECT_ORDER_SELECT_SQL}
    FROM "QuoteProjectOrder"
    WHERE "quoteRequestId" = ${quoteRequestId}
    LIMIT 1
  `);
  return rows[0] ? serializeQuoteProjectOrder(rows[0]) : null;
}

export async function listQuoteProjectEvents(projectOrderId: string) {
  await ensureQuoteProjectsSchema();
  const rows = await prisma.$queryRaw<QuoteProjectEventRow[]>(Prisma.sql`
    SELECT ${QUOTE_PROJECT_EVENT_SELECT_SQL}
    FROM "QuoteProjectEvent"
    WHERE "projectOrderId" = ${projectOrderId}
    ORDER BY "createdAt" DESC
  `);
  return rows.map(serializeQuoteProjectEvent);
}

export async function appendQuoteProjectEvent(input: {
  projectOrderId: string;
  eventType: string;
  eventLabel: string;
  eventDetail?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, Prisma.JsonValue> | null;
}) {
  await ensureQuoteProjectsSchema();
  const id = crypto.randomUUID();
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "QuoteProjectEvent" (
      "id",
      "projectOrderId",
      "eventType",
      "eventLabel",
      "eventDetail",
      "actorUserId",
      "actorName",
      "metadata",
      "createdAt"
    ) VALUES (
      ${id},
      ${input.projectOrderId},
      ${input.eventType},
      ${input.eventLabel},
      ${input.eventDetail ?? null},
      ${input.actorUserId ?? null},
      ${input.actorName ?? null},
      ${(input.metadata ?? null) as Prisma.JsonObject | null},
      CURRENT_TIMESTAMP
    )
  `);
}

export async function upsertQuoteProjectOrder(input: {
  quoteRequestId: string;
  stage?: QuoteProjectStage;
  paymentTerm?: QuoteProjectPaymentTerm;
  totalAmount: number;
  depositPercent?: number | null;
  depositRequiredAmount?: number | null;
  depositPaidAmount?: number | null;
  amountPaidTotal?: number | null;
  scheduledDate?: Date | null;
  completedAt?: Date | null;
  postedToPosAt?: Date | null;
  postedReceiptNumber?: string | null;
  assignedStaffId?: string | null;
  assignedStaffEmail?: string | null;
  assignedStaffName?: string | null;
  internalNotes?: string | null;
  actorUserId?: string | null;
  createEvent?: {
    eventType: string;
    eventLabel: string;
    eventDetail?: string | null;
    metadata?: Record<string, Prisma.JsonValue> | null;
  } | null;
}) {
  await ensureQuoteProjectsSchema();
  const existing = await getQuoteProjectOrderByQuoteRequestId(input.quoteRequestId);
  const currentStage = input.stage
    ? normalizeProjectStage(input.stage)
    : existing?.stage ?? "RECEIPT_CREATED";
  const financials = computeQuoteProjectFinancials({
    stage: currentStage,
    totalAmount: input.totalAmount,
    paymentTerm: input.paymentTerm ?? existing?.paymentTerm ?? "DEPOSIT_AND_BALANCE",
    depositPercent: input.depositPercent ?? existing?.depositPercent ?? 30,
    depositRequiredAmount: input.depositRequiredAmount ?? existing?.depositRequiredAmount ?? null,
    depositPaidAmount: input.depositPaidAmount ?? existing?.depositPaidAmount ?? null,
    amountPaidTotal: input.amountPaidTotal ?? existing?.amountPaidTotal ?? null,
  });

  const completedAt =
    currentStage === "COMPLETED_POSTED"
      ? input.completedAt ?? (existing?.completedAt ? new Date(existing.completedAt) : new Date())
      : input.completedAt ?? (existing?.completedAt ? new Date(existing.completedAt) : null);
  const postedToPosAt =
    currentStage === "COMPLETED_POSTED"
      ? input.postedToPosAt ?? (existing?.postedToPosAt ? new Date(existing.postedToPosAt) : new Date())
      : input.postedToPosAt ?? (existing?.postedToPosAt ? new Date(existing.postedToPosAt) : null);

  if (existing) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "QuoteProjectOrder"
      SET
        "stage" = ${currentStage},
        "paymentTerm" = ${financials.paymentTerm},
        "paymentStatus" = ${financials.paymentStatus},
        "totalAmount" = ${financials.totalAmount},
        "depositPercent" = ${financials.depositPercent},
        "depositRequiredAmount" = ${financials.depositRequiredAmount},
        "depositPaidAmount" = ${financials.depositPaidAmount},
        "amountPaidTotal" = ${financials.amountPaidTotal},
        "balanceAmount" = ${financials.balanceAmount},
        "scheduledDate" = ${input.scheduledDate ?? (existing.scheduledDate ? new Date(existing.scheduledDate) : null)},
        "completedAt" = ${completedAt},
        "postedToPosAt" = ${postedToPosAt},
        "postedReceiptNumber" = ${input.postedReceiptNumber ?? existing.postedReceiptNumber ?? null},
        "assignedStaffId" = ${input.assignedStaffId ?? existing.assignedStaffId ?? null},
        "assignedStaffEmail" = ${input.assignedStaffEmail ?? existing.assignedStaffEmail ?? null},
        "assignedStaffName" = ${input.assignedStaffName ?? existing.assignedStaffName ?? null},
        "internalNotes" = ${input.internalNotes ?? existing.internalNotes ?? null},
        "updatedById" = ${input.actorUserId ?? existing.updatedById ?? null},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${existing.id}
    `);
  } else {
    const id = crypto.randomUUID();
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "QuoteProjectOrder" (
        "id",
        "quoteRequestId",
        "stage",
        "paymentTerm",
        "paymentStatus",
        "totalAmount",
        "depositPercent",
        "depositRequiredAmount",
        "depositPaidAmount",
        "amountPaidTotal",
        "balanceAmount",
        "scheduledDate",
        "completedAt",
        "postedToPosAt",
        "postedReceiptNumber",
        "assignedStaffId",
        "assignedStaffEmail",
        "assignedStaffName",
        "internalNotes",
        "createdById",
        "updatedById",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${id},
        ${input.quoteRequestId},
        ${currentStage},
        ${financials.paymentTerm},
        ${financials.paymentStatus},
        ${financials.totalAmount},
        ${financials.depositPercent},
        ${financials.depositRequiredAmount},
        ${financials.depositPaidAmount},
        ${financials.amountPaidTotal},
        ${financials.balanceAmount},
        ${input.scheduledDate ?? null},
        ${completedAt},
        ${postedToPosAt},
        ${input.postedReceiptNumber ?? null},
        ${input.assignedStaffId ?? null},
        ${input.assignedStaffEmail ?? null},
        ${input.assignedStaffName ?? null},
        ${input.internalNotes ?? null},
        ${input.actorUserId ?? null},
        ${input.actorUserId ?? null},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);
  }

  const saved = await getQuoteProjectOrderByQuoteRequestId(input.quoteRequestId);
  if (saved && input.createEvent) {
    await appendQuoteProjectEvent({
      projectOrderId: saved.id,
      eventType: input.createEvent.eventType,
      eventLabel: input.createEvent.eventLabel,
      eventDetail: input.createEvent.eventDetail,
      actorUserId: input.actorUserId ?? null,
      actorName: null,
      metadata: input.createEvent.metadata ?? null,
    });
  }
  return saved;
}
