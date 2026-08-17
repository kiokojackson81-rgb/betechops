import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertLppEligibleForRelease,
  buildLppReminderIdempotencyKey,
  computeLppFinancialSummary,
  deriveLppOperationalStatus,
  generateLppReference,
  normalizeLppPaymentStatus,
  normalizeLppStatus,
  type LipaPolePolePaymentMethod,
} from "@/lib/lipaPolePole";
import { extractMpesaTransactionCode } from "@/lib/mpesaReference";
import {
  sendLppLifecycleChannelNotification,
  sendLppReminderChannelNotification,
  type LppLifecycleEvent,
  type LppLifecycleNotificationContext,
  type LppLifecycleRecipient,
} from "@/lib/lipaPolePoleNotifications";

type DbClient = typeof prisma | Prisma.TransactionClient;

type RawUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  attendantCategory: string | null;
  createdAt: Date;
};

type RawLppRow = {
  id: string;
  reference: string;
  customerId: string;
  productId: string | null;
  customProductName: string | null;
  itemSerial: string | null;
  itemWarranty: string | null;
  publicToken: string;
  quantity: number;
  agreedUnitPrice: Prisma.Decimal;
  agreedTotal: Prisma.Decimal;
  currency: string;
  status: string;
  paymentMode: string;
  reservationMode: string;
  expectedCompletionDate: Date | null;
  assignedToId: string | null;
  salespersonId: string | null;
  source: string | null;
  notes: string | null;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  completedAt: Date | null;
  convertedAt: Date | null;
  convertedById: string | null;
  convertedReceiptId: string | null;
  convertedProjectId: string | null;
  fulfilledAt: Date | null;
  fulfilledById: string | null;
  fulfillmentMethod: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RawLppPaymentRow = {
  id: string;
  lipaPolePoleId: string;
  amount: Prisma.Decimal;
  method: string;
  reference: string | null;
  status: string;
  receivedById: string | null;
  receivedAt: Date;
  notes: string | null;
  verifiedAt: Date | null;
  verifiedById: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  reversedAt: Date | null;
  reversedById: string | null;
  reversalReason: string | null;
  createdAt: Date;
};

type RawLppItemRow = {
  id: string;
  lipaPolePoleId: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  total: Prisma.Decimal;
  serial: string | null;
  warranty: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

type RawLppEventRow = {
  id: string;
  lipaPolePoleId: string;
  eventType: string;
  actorId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

type RawLppReminderRow = {
  id: string;
  lipaPolePoleId: string;
  reminderType: string;
  scheduledFor: Date;
  sentAt: Date | null;
  channel: string;
  status: string;
  providerMessageId: string | null;
  idempotencyKey: string;
  payloadSnapshot: Prisma.JsonValue | null;
  createdAt: Date;
};

type RawLppReminderDispatchRow = {
  reference: string;
  currency: string;
  expectedCompletionDate: Date;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  productName: string | null;
};

type RawLppFollowUpRow = {
  id: string;
  lipaPolePoleId: string;
  assignedToId: string | null;
  assignedToName: string | null;
  outcome: string | null;
  taskType: string;
  taskDate: Date | null;
  notes: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RawLppPromiseRow = {
  id: string;
  lipaPolePoleId: string;
  promiseAmount: Prisma.Decimal;
  promiseDate: Date;
  status: string;
  notes: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RawLppInstallmentRow = {
  id: string;
  lipaPolePoleId: string;
  dueDate: Date;
  expectedAmount: Prisma.Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LppCustomerServiceAgent = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  attendantCategory: string | null;
};

export type SerializedLppAccount = {
  id: string;
  reference: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerCounty: string | null;
  customerTown: string | null;
  customerEstateLandmark: string | null;
  customerLocationNotes: string | null;
  productId: string | null;
  productName: string | null;
  itemSerial: string | null;
  itemWarranty: string | null;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  quantity: number;
  agreedUnitPrice: number;
  assignedToId: string | null;
  assignedToName: string | null;
  salespersonId: string | null;
  salespersonName: string | null;
  agreedTotal: number;
  totalPaid: number;
  balance: number;
  percentagePaid: number;
  status: string;
  paymentMode: string;
  reservationMode: string;
  source: string | null;
  expectedCompletionDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  convertedAt: string | null;
  convertedReceiptId: string | null;
  convertedProjectId: string | null;
  fulfilledAt: string | null;
  fulfilledById: string | null;
  fulfilledByName: string | null;
  fulfillmentMethod: string | null;
};

export type SerializedLppPayment = {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  receivedById: string | null;
  receivedAt: string;
  notes: string | null;
  verifiedAt: string | null;
  verifiedById: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  createdAt: string;
};

export type SerializedLppItem = {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  serial: string | null;
  warranty: string | null;
  position: number;
};

export type SerializedLppEvent = {
  id: string;
  eventType: string;
  actorId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

export type SerializedLppReminder = {
  id: string;
  reminderType: string;
  scheduledFor: string;
  sentAt: string | null;
  channel: string;
  status: string;
  providerMessageId: string | null;
  idempotencyKey: string;
  payloadSnapshot: Prisma.JsonValue | null;
  createdAt: string;
};

export type SerializedLppFollowUp = {
  id: string;
  assignedToId: string | null;
  assignedToName: string | null;
  outcome: string | null;
  taskType: string;
  taskDate: string | null;
  notes: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedLppPromise = {
  id: string;
  promiseAmount: number;
  promiseDate: string;
  status: string;
  notes: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedLppInstallment = {
  id: string;
  dueDate: string;
  expectedAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LppAssignmentMethod = "ROUND_ROBIN" | "MANUAL";

export type CreateLppInput = {
  customerId: string;
  productId?: string | null;
  customProductName?: string | null;
  itemSerial?: string | null;
  itemWarranty?: string | null;
  items?: Array<{
    productId?: string | null;
    description: string;
    quantity?: number;
    unitPrice: number | string | Prisma.Decimal;
    serial?: string | null;
    warranty?: string | null;
  }>;
  quantity?: number;
  agreedUnitPrice: number | string | Prisma.Decimal;
  agreedTotal?: number | string | Prisma.Decimal | null;
  currency?: string;
  paymentMode?: "FLEXIBLE" | "SCHEDULED";
  reservationMode?: "NONE" | "SOFT_RESERVE" | "HARD_RESERVE";
  expectedCompletionDate?: Date | string | null;
  salespersonId?: string | null;
  source?: string | null;
  notes?: string | null;
  termsAcceptedAt?: Date | string | null;
  termsVersion?: string | null;
  createdById?: string | null;
  installmentPlan?: {
    frequency: "WEEKLY" | "MONTHLY";
    count: number;
  } | null;
  initialPayment?: {
    amount: number | string | Prisma.Decimal;
    method: LipaPolePolePaymentMethod;
    reference?: string | null;
    receivedById?: string | null;
    notes?: string | null;
    receivedAt?: Date | string | null;
    status?: "PENDING" | "SUCCESS";
  } | null;
  assignment?: {
    assignedToId?: string | null;
    assignedById?: string | null;
    method?: LppAssignmentMethod;
    eligibleRoleNames?: string[];
    eligibleCategories?: string[];
  } | null;
};

export type AssignLppInput = {
  lipaPolePoleId: string;
  assignedToId?: string | null;
  assignedById?: string | null;
  method?: LppAssignmentMethod;
  notes?: string | null;
  eligibleRoleNames?: string[];
  eligibleCategories?: string[];
};

export type RecordLppPaymentInput = {
  lipaPolePoleId: string;
  amount: number | string | Prisma.Decimal;
  method: LipaPolePolePaymentMethod;
  reference?: string | null;
  receivedById?: string | null;
  receivedAt?: Date | string | null;
  notes?: string | null;
  allowOverpaymentOverride?: boolean;
  status?: "PENDING" | "SUCCESS";
};

export type ReviewLppPaymentInput = {
  lipaPolePoleId: string;
  paymentId: string;
  reviewedById?: string | null;
  action: "VERIFY" | "REJECT";
  rejectionReason?: string | null;
};

export type ReverseLppPaymentInput = {
  lipaPolePoleId: string;
  paymentId: string;
  reversedById?: string | null;
  reason: string;
  reversedAt?: Date | string | null;
  allowConvertedCorrection?: boolean;
};

export type CompletionResult = {
  lpp: RawLppRow;
  summary: ReturnType<typeof computeLppFinancialSummary>;
};

export type ConvertLppToPosInput = {
  lipaPolePoleId: string;
  receiptId: string;
  convertedById?: string | null;
};

export type ConvertLppToProjectInput = {
  lipaPolePoleId: string;
  projectId: string;
  convertedById?: string | null;
};

export type ReleaseLppProductInput = {
  lipaPolePoleId: string;
  fulfilledById?: string | null;
  fulfilledAt?: Date | string | null;
  fulfillmentMethod: string;
  collectorName?: string | null;
  collectorReference?: string | null;
  notes?: string | null;
};

export type CreateLppFollowUpInput = {
  lipaPolePoleId: string;
  assignedToId?: string | null;
  taskType: string;
  taskDate?: Date | string | null;
  outcome?: string | null;
  notes?: string | null;
  createdById?: string | null;
};

export type CreateLppPromiseInput = {
  lipaPolePoleId: string;
  promiseAmount: number | string | Prisma.Decimal;
  promiseDate: Date | string;
  notes?: string | null;
  createdById?: string | null;
};

export type ProcessLppReminderSummary = {
  scanned: number;
  reminderRecordsCreated: number;
  followUpsCreated: number;
  promisesBroken: number;
  notificationsSent: number;
  notificationsFailed: number;
  notificationsSkipped: number;
  results: Array<Record<string, unknown>>;
};

const DEFAULT_LPP_ELIGIBLE_ROLE_NAMES = [
  "ADMIN",
  "SUPERVISOR",
  "ATTENDANT",
] as const;
const DEFAULT_LPP_ELIGIBLE_CATEGORIES = ["BETECH_OPS"] as const;

function normalizeOptionalDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_DATE");
  }
  return date;
}

function trimToNull(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function toMoney(value: number | string | Prisma.Decimal) {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}

function splitInstallmentAmounts(total: Prisma.Decimal, count: number) {
  const safeCount = Math.max(1, Math.trunc(count));
  const totalCents = Math.round(Number(total) * 100);
  const baseCents = Math.floor(totalCents / safeCount);
  const remainder = totalCents - baseCents * safeCount;
  return Array.from({ length: safeCount }, (_, index) => {
    const cents = baseCents + (index === safeCount - 1 ? remainder : 0);
    return new Prisma.Decimal(cents).div(100);
  });
}

function addInstallmentDueDate(
  base: Date,
  index: number,
  frequency: "WEEKLY" | "MONTHLY",
) {
  const dueDate = new Date(base);
  if (frequency === "WEEKLY") {
    dueDate.setDate(dueDate.getDate() + (index + 1) * 7);
    return dueDate;
  }
  dueDate.setMonth(dueDate.getMonth() + index + 1);
  return dueDate;
}

async function replaceLppInstallments(
  tx: Prisma.TransactionClient,
  input: {
    lipaPolePoleId: string;
    total: Prisma.Decimal;
    createdAt: Date;
    frequency: "WEEKLY" | "MONTHLY";
    count: number;
  },
) {
  await tx.lipaPolePoleInstallment.deleteMany({
    where: { lipaPolePoleId: input.lipaPolePoleId },
  });

  const amounts = splitInstallmentAmounts(input.total, input.count);
  if (!amounts.length || amounts.every((amount) => amount.lte(0))) return;

  await tx.lipaPolePoleInstallment.createMany({
    data: amounts.map((amount, index) => ({
      lipaPolePoleId: input.lipaPolePoleId,
      dueDate: addInstallmentDueDate(input.createdAt, index, input.frequency),
      expectedAmount: amount,
    })),
  });
}

function mapAgent(row: RawUserRow): LppCustomerServiceAgent {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    attendantCategory: row.attendantCategory,
  };
}

export function pickNextRoundRobinAgent(
  eligibleAgents: LppCustomerServiceAgent[],
  previousAssignedToId: string | null,
) {
  if (!eligibleAgents.length) {
    throw new Error("NO_ELIGIBLE_CUSTOMER_SERVICE_AGENT");
  }

  const sorted = [...eligibleAgents].sort((a, b) => {
    const aKey = `${a.name ?? ""}|${a.email ?? ""}|${a.id}`;
    const bKey = `${b.name ?? ""}|${b.email ?? ""}|${b.id}`;
    return aKey.localeCompare(bKey);
  });

  if (!previousAssignedToId) {
    return sorted[0];
  }

  const previousIndex = sorted.findIndex(
    (agent) => agent.id === previousAssignedToId,
  );
  if (previousIndex === -1) {
    return sorted[0];
  }
  return sorted[(previousIndex + 1) % sorted.length];
}

async function withLppTransaction<T>(
  db: DbClient,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  if ("$transaction" in db && typeof db.$transaction === "function") {
    return db.$transaction(async (tx) => run(tx), { timeout: 15_000 });
  }
  return run(db as Prisma.TransactionClient);
}

async function writeLppEvent(
  db: DbClient,
  input: {
    lipaPolePoleId: string;
    eventType: string;
    actorId?: string | null;
    metadata?: Record<string, Prisma.JsonValue> | null;
  },
) {
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "LipaPolePoleEvent" ("id", "lipaPolePoleId", "eventType", "actorId", "metadata", "createdAt")
    VALUES (
      ${randomUUID()},
      ${input.lipaPolePoleId},
      ${input.eventType},
      ${input.actorId ?? null},
      ${(input.metadata ?? null) as Prisma.JsonObject | null},
      CURRENT_TIMESTAMP
    )
  `);
}

async function writeActionLog(
  db: DbClient,
  input: {
    actorId?: string | null;
    entity: string;
    entityId: string;
    action: string;
    before?: Prisma.JsonValue | null;
    after?: Prisma.JsonValue | null;
  },
) {
  if (!input.actorId) return;
  await db.actionLog.create({
    data: {
      actorId: input.actorId,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

async function getLppById(db: DbClient, lipaPolePoleId: string) {
  const rows = await db.$queryRaw<RawLppRow[]>(Prisma.sql`
    SELECT *
    FROM "LipaPolePole"
    WHERE "id" = ${lipaPolePoleId}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function getLppPayments(db: DbClient, lipaPolePoleId: string) {
  return db.$queryRaw<RawLppPaymentRow[]>(Prisma.sql`
    SELECT *
    FROM "LipaPolePolePayment"
    WHERE "lipaPolePoleId" = ${lipaPolePoleId}
    ORDER BY "receivedAt" ASC, "createdAt" ASC
  `);
}

async function getLppItems(db: DbClient, lipaPolePoleId: string) {
  return db.$queryRaw<RawLppItemRow[]>(Prisma.sql`
    SELECT *
    FROM "LipaPolePoleItem"
    WHERE "lipaPolePoleId" = ${lipaPolePoleId}
    ORDER BY "position" ASC, "createdAt" ASC
  `);
}

async function getLppEvents(db: DbClient, lipaPolePoleId: string) {
  return db.$queryRaw<RawLppEventRow[]>(Prisma.sql`
    SELECT *
    FROM "LipaPolePoleEvent"
    WHERE "lipaPolePoleId" = ${lipaPolePoleId}
    ORDER BY "createdAt" DESC
  `);
}

async function getLppReminders(db: DbClient, lipaPolePoleId: string) {
  return db.$queryRaw<RawLppReminderRow[]>(Prisma.sql`
    SELECT *
    FROM "LipaPolePoleReminder"
    WHERE "lipaPolePoleId" = ${lipaPolePoleId}
    ORDER BY "scheduledFor" DESC, "createdAt" DESC
  `);
}

async function getLppFollowUps(db: DbClient, lipaPolePoleId: string) {
  return db.$queryRaw<RawLppFollowUpRow[]>(Prisma.sql`
    SELECT
      fu."id",
      fu."lipaPolePoleId",
      fu."assignedToId",
      a."name" AS "assignedToName",
      fu."outcome",
      fu."taskType",
      fu."taskDate",
      fu."notes",
      fu."createdById",
      c."name" AS "createdByName",
      fu."createdAt",
      fu."updatedAt"
    FROM "LipaPolePoleFollowUp" fu
    LEFT JOIN "User" a ON a."id" = fu."assignedToId"
    LEFT JOIN "User" c ON c."id" = fu."createdById"
    WHERE fu."lipaPolePoleId" = ${lipaPolePoleId}
    ORDER BY COALESCE(fu."taskDate", fu."createdAt") DESC, fu."createdAt" DESC
  `);
}

async function getLppPromises(db: DbClient, lipaPolePoleId: string) {
  return db.$queryRaw<RawLppPromiseRow[]>(Prisma.sql`
    SELECT
      p."id",
      p."lipaPolePoleId",
      p."promiseAmount",
      p."promiseDate",
      p."status",
      p."notes",
      p."createdById",
      c."name" AS "createdByName",
      p."createdAt",
      p."updatedAt"
    FROM "LipaPolePolePromise" p
    LEFT JOIN "User" c ON c."id" = p."createdById"
    WHERE p."lipaPolePoleId" = ${lipaPolePoleId}
    ORDER BY p."promiseDate" DESC, p."createdAt" DESC
  `);
}

async function getLppInstallments(db: DbClient, lipaPolePoleId: string) {
  return db.$queryRaw<RawLppInstallmentRow[]>(Prisma.sql`
    SELECT *
    FROM "LipaPolePoleInstallment"
    WHERE "lipaPolePoleId" = ${lipaPolePoleId}
    ORDER BY "dueDate" ASC, "createdAt" ASC
  `);
}

async function getLppReminderDispatchContext(
  db: DbClient,
  lipaPolePoleId: string,
) {
  const rows = await db.$queryRaw<RawLppReminderDispatchRow[]>(Prisma.sql`
    SELECT
      lpp."reference",
      lpp."currency",
      lpp."expectedCompletionDate",
      c."name" AS "customerName",
      c."phone" AS "customerPhone",
      c."email" AS "customerEmail",
      COALESCE(NULLIF(lpp."customProductName", ''), p."name") AS "productName"
    FROM "LipaPolePole" lpp
    LEFT JOIN "User" c ON c."id" = lpp."customerId"
    LEFT JOIN "Product" p ON p."id" = lpp."productId"
    WHERE lpp."id" = ${lipaPolePoleId}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function lockLppOrThrow(db: DbClient, lipaPolePoleId: string) {
  const rows = await db.$queryRaw<RawLppRow[]>(Prisma.sql`
    SELECT *
    FROM "LipaPolePole"
    WHERE "id" = ${lipaPolePoleId}
    FOR UPDATE
  `);
  const row = rows[0] ?? null;
  if (!row) throw new Error("LPP_NOT_FOUND");
  return row;
}

async function nextLppReference(db: DbClient, now = new Date()) {
  const year = now.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

  const rows = await db.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM "LipaPolePole"
    WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
  `);
  const count = Number(rows[0]?.count ?? 0);
  return generateLppReference({ date: now, sequence: count + 1 });
}

async function getEligibleCustomerServiceAgents(
  db: DbClient,
  input?: {
    eligibleRoleNames?: string[];
    eligibleCategories?: string[];
  },
) {
  const roles = (
    input?.eligibleRoleNames?.length
      ? input.eligibleRoleNames
      : [...DEFAULT_LPP_ELIGIBLE_ROLE_NAMES]
  ).map((value) => String(value).trim().toUpperCase());
  const categories = (
    input?.eligibleCategories?.length
      ? input.eligibleCategories
      : [...DEFAULT_LPP_ELIGIBLE_CATEGORIES]
  ).map((value) => String(value).trim().toUpperCase());

  const roleSql = roles.length
    ? Prisma.sql`OR "role"::text IN (${Prisma.join(roles)})`
    : Prisma.empty;
  const categorySql = categories.length
    ? Prisma.sql`OR COALESCE("attendantCategory"::text, '') IN (${Prisma.join(categories)})`
    : Prisma.empty;

  const rows = await db.$queryRaw<RawUserRow[]>(Prisma.sql`
    SELECT
      "id",
      "email",
      "name",
      "role"::text AS "role",
      "attendantCategory"::text AS "attendantCategory",
      "createdAt"
    FROM "User"
    WHERE "isActive" = true
      AND (false ${roleSql} ${categorySql})
    ORDER BY COALESCE("name", "email", "id") ASC, "createdAt" ASC
  `);
  return rows.map(mapAgent);
}

async function getPreviousAssignedAgentId(
  db: DbClient,
  eligibleAgentIds: string[],
) {
  if (!eligibleAgentIds.length) return null;
  const rows = await db.$queryRaw<Array<{ assignedToId: string }>>(Prisma.sql`
    SELECT "assignedToId"
    FROM "LipaPolePoleAssignment"
    WHERE "assignedToId" IN (${Prisma.join(eligibleAgentIds)})
    ORDER BY "assignedAt" DESC
    LIMIT 1
  `);
  return rows[0]?.assignedToId ?? null;
}

async function updateLppStatusAndCompletion(
  db: DbClient,
  input: {
    lpp: RawLppRow;
    payments: RawLppPaymentRow[];
    now?: Date;
  },
) {
  const summary = computeLppFinancialSummary({
    agreedTotal: input.lpp.agreedTotal,
    payments: input.payments,
  });
  const currentStatus = normalizeLppStatus(input.lpp.status);
  const nextStatus = deriveLppOperationalStatus({
    currentStatus,
    agreedTotal: input.lpp.agreedTotal,
    payments: input.payments,
    expectedCompletionDate: input.lpp.expectedCompletionDate,
    convertedReceiptId: input.lpp.convertedReceiptId,
    convertedProjectId: input.lpp.convertedProjectId,
    fulfilledAt: input.lpp.fulfilledAt,
    now: input.now,
  });

  const completedAt =
    summary.isFullyPaid &&
    !input.lpp.convertedReceiptId &&
    !input.lpp.convertedProjectId
      ? (input.lpp.completedAt ?? input.now ?? new Date())
      : null;

  await db.$executeRaw(Prisma.sql`
    UPDATE "LipaPolePole"
    SET
      "status" = ${nextStatus}::"LipaPolePoleStatus",
      "completedAt" = ${completedAt},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.lpp.id}
  `);

  if (summary.isFullyPaid) {
    await db.$executeRaw(Prisma.sql`
      UPDATE "LipaPolePoleReminder"
      SET "status" = 'CANCELLED'
      WHERE "lipaPolePoleId" = ${input.lpp.id}
        AND "status" IN ('PENDING', 'PROCESSING')
    `);
  }

  const refreshed = await getLppById(db, input.lpp.id);
  if (!refreshed) throw new Error("LPP_NOT_FOUND_AFTER_UPDATE");
  return { lpp: refreshed, summary };
}

function ensureLppEligibleForConversion(
  lpp: RawLppRow,
  summary: ReturnType<typeof computeLppFinancialSummary>,
) {
  if (!summary.isFullyPaid) {
    throw new Error("LPP_BALANCE_NOT_ZERO");
  }

  const status = normalizeLppStatus(lpp.status);
  if (["CANCELLED", "REFUNDED", "CLOSED"].includes(status)) {
    throw new Error("LPP_NOT_CONVERTIBLE");
  }

  if (lpp.convertedReceiptId || lpp.convertedProjectId) {
    throw new Error("LPP_ALREADY_CONVERTED");
  }
}

async function isLppFinalTransactionFullyPaid(
  lpp: RawLppRow,
  db: DbClient = prisma,
) {
  if (lpp.convertedReceiptId) {
    const rows = await db.$queryRaw<
      Array<{ paymentStatus: string | null }>
    >(Prisma.sql`
      SELECT o."paymentStatus"::text AS "paymentStatus"
      FROM "Receipt" r
      INNER JOIN "Order" o ON o."id" = r."orderId"
      WHERE r."id" = ${lpp.convertedReceiptId}
      LIMIT 1
    `);
    return rows[0]?.paymentStatus === "PAID";
  }

  if (lpp.convertedProjectId) {
    const rows = await db.$queryRaw<
      Array<{ paymentStatus: string }>
    >(Prisma.sql`
      SELECT "paymentStatus"
      FROM "QuoteProjectOrder"
      WHERE "quoteRequestId" = ${lpp.convertedProjectId}
      LIMIT 1
    `);
    return rows[0]?.paymentStatus === "FULLY_PAID";
  }

  return false;
}

export async function assignLipaPolePole(
  input: AssignLppInput,
  db: DbClient = prisma,
) {
  return withLppTransaction(db, async (tx) => {
    const lpp = await lockLppOrThrow(tx, input.lipaPolePoleId);
    const previousAssignedToId = lpp.assignedToId;

    let assignedAgentId = trimToNull(input.assignedToId);
    let assignmentMethod: LppAssignmentMethod =
      input.method ?? (assignedAgentId ? "MANUAL" : "ROUND_ROBIN");

    if (!assignedAgentId) {
      const eligibleAgents = await getEligibleCustomerServiceAgents(tx, {
        eligibleRoleNames: input.eligibleRoleNames,
        eligibleCategories: input.eligibleCategories,
      });
      const previous = await getPreviousAssignedAgentId(
        tx,
        eligibleAgents.map((agent) => agent.id),
      );
      assignedAgentId = pickNextRoundRobinAgent(eligibleAgents, previous).id;
      assignmentMethod = "ROUND_ROBIN";
    }

    await tx.$executeRaw(Prisma.sql`
      UPDATE "LipaPolePole"
      SET "assignedToId" = ${assignedAgentId}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${input.lipaPolePoleId}
    `);

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "LipaPolePoleAssignment" (
        "id", "lipaPolePoleId", "assignedToId", "assignedAt", "assignedById", "assignmentMethod", "notes"
      ) VALUES (
        ${randomUUID()},
        ${input.lipaPolePoleId},
        ${assignedAgentId},
        CURRENT_TIMESTAMP,
        ${input.assignedById ?? null},
        ${assignmentMethod},
        ${trimToNull(input.notes)}
      )
    `);

    await writeLppEvent(tx, {
      lipaPolePoleId: input.lipaPolePoleId,
      eventType: previousAssignedToId ? "REASSIGNED" : "ASSIGNED",
      actorId: input.assignedById ?? null,
      metadata: {
        previousAssignedToId,
        assignedToId: assignedAgentId,
        assignmentMethod,
      },
    });
    await writeActionLog(tx, {
      actorId: input.assignedById ?? null,
      entity: "LipaPolePole",
      entityId: input.lipaPolePoleId,
      action: previousAssignedToId ? "REASSIGN" : "ASSIGN",
      before: previousAssignedToId
        ? ({ assignedToId: previousAssignedToId } as Prisma.JsonObject)
        : null,
      after: {
        assignedToId: assignedAgentId,
        assignmentMethod,
      } as Prisma.JsonObject,
    });

    const updated = await getLppById(tx, input.lipaPolePoleId);
    if (!updated) throw new Error("LPP_NOT_FOUND_AFTER_ASSIGNMENT");
    return updated;
  });
}

export async function createLipaPolePole(
  input: CreateLppInput,
  db: DbClient = prisma,
) {
  const normalizedItems = (
    input.items?.length
      ? input.items
      : [
          {
            productId: input.productId,
            description: input.customProductName ?? "",
            quantity: input.quantity,
            unitPrice: input.agreedUnitPrice,
            serial: input.itemSerial,
            warranty: input.itemWarranty,
          },
        ]
  ).map((item) => {
    const quantity = Math.max(1, Math.trunc(Number(item.quantity ?? 1)));
    const unitPrice = toMoney(item.unitPrice);
    const description = trimToNull(item.description);
    if (!description || unitPrice.lte(0)) throw new Error("INVALID_PRODUCT");
    return {
      productId: trimToNull(item.productId ?? null),
      description,
      quantity,
      unitPrice,
      total: unitPrice.mul(quantity),
      serial: trimToNull(item.serial ?? null),
      warranty: trimToNull(item.warranty ?? null),
    };
  });
  if (!normalizedItems.length) throw new Error("INVALID_PRODUCT");
  const firstItem = normalizedItems[0];
  const quantity = firstItem.quantity;
  const agreedUnitPrice = firstItem.unitPrice;
  const agreedTotal = normalizedItems.reduce(
    (total, item) => total.add(item.total),
    new Prisma.Decimal(0),
  );
  if (agreedTotal.lte(0)) throw new Error("INVALID_AGREED_TOTAL");
  const productId = firstItem.productId;
  const customProductName = firstItem.description;
  const itemSerial = firstItem.serial;
  const itemWarranty = firstItem.warranty;

  const created = await withLppTransaction(db, async (tx) => {
    const now = new Date();
    const reference = await nextLppReference(tx, now);
    const id = randomUUID();
    const publicToken = randomUUID();
    const initialPaymentAmount = input.initialPayment
      ? toMoney(input.initialPayment.amount)
      : new Prisma.Decimal(0);
    const remainingBalance = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      agreedTotal.sub(initialPaymentAmount),
    );

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "LipaPolePole" (
        "id", "reference", "customerId", "productId", "customProductName", "itemSerial", "itemWarranty", "publicToken", "quantity", "agreedUnitPrice", "agreedTotal",
        "currency", "status", "paymentMode", "reservationMode", "expectedCompletionDate", "salespersonId",
        "source", "notes", "termsAcceptedAt", "termsVersion", "createdById", "createdAt", "updatedAt"
      ) VALUES (
        ${id},
        ${reference},
        ${input.customerId},
        ${productId},
        ${customProductName},
        ${itemSerial},
        ${itemWarranty},
        ${publicToken},
        ${quantity},
        ${agreedUnitPrice},
        ${agreedTotal},
        ${trimToNull(input.currency) ?? "KES"},
        ${"DRAFT"}::"LipaPolePoleStatus",
        ${trimToNull(input.paymentMode) ?? "FLEXIBLE"}::"LipaPolePolePaymentMode",
        ${trimToNull(input.reservationMode) ?? "SOFT_RESERVE"}::"LipaPolePoleReservationMode",
        ${normalizeOptionalDate(input.expectedCompletionDate)},
        ${trimToNull(input.salespersonId ?? null)},
        ${trimToNull(input.source ?? null)},
        ${trimToNull(input.notes ?? null)},
        ${normalizeOptionalDate(input.termsAcceptedAt)},
        ${trimToNull(input.termsVersion ?? null)},
        ${trimToNull(input.createdById ?? null)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);

    for (const [position, item] of normalizedItems.entries()) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "LipaPolePoleItem" (
          "id", "lipaPolePoleId", "productId", "description", "quantity", "unitPrice", "total",
          "serial", "warranty", "position", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${id}, ${item.productId}, ${item.description}, ${item.quantity}, ${item.unitPrice}, ${item.total},
          ${item.serial}, ${item.warranty}, ${position}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `);
    }

    await writeLppEvent(tx, {
      lipaPolePoleId: id,
      eventType: "LPP_CREATED",
      actorId: input.createdById ?? null,
      metadata: {
        reference,
        customerId: input.customerId,
        productId,
        customProductName,
        itemSerial,
        itemWarranty,
        itemCount: normalizedItems.length,
        agreedTotal: agreedTotal.toString(),
      },
    });
    await writeActionLog(tx, {
      actorId: input.createdById ?? null,
      entity: "LipaPolePole",
      entityId: id,
      action: "CREATE",
      after: {
        reference,
        customerId: input.customerId,
        productId,
        customProductName,
        itemSerial,
        itemWarranty,
        items: normalizedItems.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          total: item.total.toString(),
          serial: item.serial,
          warranty: item.warranty,
        })),
        quantity,
        agreedUnitPrice: agreedUnitPrice.toString(),
        agreedTotal: agreedTotal.toString(),
      } as Prisma.JsonObject,
    });

    if (input.initialPayment) {
      await recordLppPayment(
        {
          lipaPolePoleId: id,
          amount: input.initialPayment.amount,
          method: input.initialPayment.method,
          reference: input.initialPayment.reference ?? null,
          receivedById:
            input.initialPayment.receivedById ?? input.createdById ?? null,
          receivedAt: input.initialPayment.receivedAt ?? now,
          notes: input.initialPayment.notes ?? "Initial deposit",
          status: input.initialPayment.status ?? "SUCCESS",
        },
        tx,
      );
    } else {
      const created = await lockLppOrThrow(tx, id);
      await updateLppStatusAndCompletion(tx, {
        lpp: created,
        payments: [],
        now,
      });
    }

    await assignLipaPolePole(
      {
        lipaPolePoleId: id,
        assignedToId: input.assignment?.assignedToId ?? null,
        assignedById:
          input.assignment?.assignedById ?? input.createdById ?? null,
        method: input.assignment?.method,
        eligibleRoleNames: input.assignment?.eligibleRoleNames,
        eligibleCategories: input.assignment?.eligibleCategories,
      },
      tx,
    );

    if (input.installmentPlan && remainingBalance.gt(0)) {
      await replaceLppInstallments(tx, {
        lipaPolePoleId: id,
        total: remainingBalance,
        createdAt: now,
        frequency: input.installmentPlan.frequency,
        count: input.installmentPlan.count,
      });
    }

    const finalRow = await getLppById(tx, id);
    if (!finalRow) throw new Error("LPP_NOT_FOUND_AFTER_CREATE");
    return finalRow;
  });
  if (db === prisma) {
    await safelyDispatchLppLifecycleNotifications({
      lipaPolePoleId: created.id,
      event: "ACCOUNT_CREATED",
    });
  }
  return created;
}

export async function recordLppPayment(
  input: RecordLppPaymentInput,
  db: DbClient = prisma,
) {
  const amount = toMoney(input.amount);
  if (amount.lte(0)) throw new Error("INVALID_PAYMENT_AMOUNT");
  const paymentStatus = input.status ?? "SUCCESS";
  const rawReference = trimToNull(input.reference ?? null);
  const normalizedReference =
    input.method === "MPESA"
      ? (extractMpesaTransactionCode(rawReference) ??
        rawReference?.toUpperCase() ??
        null)
      : rawReference;

  const result = await withLppTransaction(db, async (tx) => {
    const lpp = await lockLppOrThrow(tx, input.lipaPolePoleId);
    const status = normalizeLppStatus(lpp.status);
    if (
      [
        "CANCELLED",
        "REFUNDED",
        "CONVERTED_TO_POS",
        "CONVERTED_TO_PROJECT",
        "CLOSED",
      ].includes(status)
    ) {
      throw new Error("LPP_NOT_ACCEPTING_PAYMENTS");
    }

    const existingPayments = await getLppPayments(tx, input.lipaPolePoleId);
    const summaryBefore = computeLppFinancialSummary({
      agreedTotal: lpp.agreedTotal,
      payments: existingPayments,
    });

    if (!input.allowOverpaymentOverride && amount.gt(summaryBefore.balance)) {
      throw new Error("LPP_OVERPAYMENT_NOT_ALLOWED");
    }

    if (normalizedReference) {
      const duplicate = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "LipaPolePolePayment"
        WHERE UPPER("reference") = UPPER(${normalizedReference})
        LIMIT 1
      `);
      if (duplicate[0]) throw new Error("DUPLICATE_PAYMENT_REFERENCE");
    }

    const paymentId = randomUUID();
    const receivedAt = normalizeOptionalDate(input.receivedAt) ?? new Date();

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "LipaPolePolePayment" (
        "id", "lipaPolePoleId", "amount", "method", "reference", "status", "receivedById", "receivedAt", "notes",
        "verifiedAt", "verifiedById", "createdAt"
      ) VALUES (
        ${paymentId},
        ${input.lipaPolePoleId},
        ${amount},
        ${input.method}::"LipaPolePolePaymentMethod",
        ${normalizedReference},
        ${paymentStatus}::"LipaPolePolePaymentStatus",
        ${trimToNull(input.receivedById ?? null)},
        ${receivedAt},
        ${trimToNull(input.notes ?? null)},
        ${paymentStatus === "SUCCESS" ? receivedAt : null},
        ${paymentStatus === "SUCCESS" ? trimToNull(input.receivedById ?? null) : null},
        CURRENT_TIMESTAMP
      )
    `);

    const paymentsAfter = await getLppPayments(tx, input.lipaPolePoleId);
    const completion = await updateLppStatusAndCompletion(tx, {
      lpp,
      payments: paymentsAfter,
      now: receivedAt,
    });

    await writeLppEvent(tx, {
      lipaPolePoleId: input.lipaPolePoleId,
      eventType:
        paymentStatus === "SUCCESS" ? "PAYMENT_RECEIVED" : "PAYMENT_SUBMITTED",
      actorId: input.receivedById ?? null,
      metadata: {
        paymentId,
        amount: amount.toString(),
        method: input.method,
        reference: normalizedReference,
        status: paymentStatus,
        totalPaid: completion.summary.totalPaid.toString(),
        balance: completion.summary.balance.toString(),
      },
    });

    if (paymentStatus === "SUCCESS" && completion.summary.isFullyPaid) {
      await writeLppEvent(tx, {
        lipaPolePoleId: input.lipaPolePoleId,
        eventType: "COMPLETED",
        actorId: input.receivedById ?? null,
        metadata: {
          totalPaid: completion.summary.totalPaid.toString(),
          balance: completion.summary.balance.toString(),
        },
      });
    }

    await writeActionLog(tx, {
      actorId: input.receivedById ?? null,
      entity: "LipaPolePole",
      entityId: input.lipaPolePoleId,
      action:
        paymentStatus === "SUCCESS" ? "PAYMENT_RECEIVED" : "PAYMENT_SUBMITTED",
      before: {
        totalPaid: summaryBefore.totalPaid.toString(),
        balance: summaryBefore.balance.toString(),
        status: lpp.status,
      } as Prisma.JsonObject,
      after: {
        paymentId,
        amount: amount.toString(),
        reference: normalizedReference,
        paymentStatus,
        totalPaid: completion.summary.totalPaid.toString(),
        balance: completion.summary.balance.toString(),
        status: completion.lpp.status,
      } as Prisma.JsonObject,
    });

    return {
      lpp: completion.lpp,
      paymentId,
      summary: completion.summary,
    };
  });
  if (db === prisma) {
    await safelyDispatchLppLifecycleNotifications({
      lipaPolePoleId: input.lipaPolePoleId,
      paymentId: result.paymentId,
      event:
        paymentStatus === "SUCCESS"
          ? result.summary.isFullyPaid
            ? "PLAN_COMPLETED"
            : "PAYMENT_RECEIVED"
          : "PAYMENT_SUBMITTED",
    });
  }
  return result;
}

export async function reviewLppPayment(
  input: ReviewLppPaymentInput,
  db: DbClient = prisma,
) {
  const rejectionReason = trimToNull(input.rejectionReason ?? null);
  if (input.action === "REJECT" && !rejectionReason)
    throw new Error("REJECTION_REASON_REQUIRED");

  const result = await withLppTransaction(db, async (tx) => {
    const lpp = await lockLppOrThrow(tx, input.lipaPolePoleId);
    const rows = await tx.$queryRaw<RawLppPaymentRow[]>(Prisma.sql`
      SELECT * FROM "LipaPolePolePayment"
      WHERE "id" = ${input.paymentId} AND "lipaPolePoleId" = ${input.lipaPolePoleId}
      FOR UPDATE
    `);
    const payment = rows[0];
    if (!payment) throw new Error("LPP_PAYMENT_NOT_FOUND");
    if (normalizeLppPaymentStatus(payment.status) !== "PENDING")
      throw new Error("LPP_PAYMENT_ALREADY_REVIEWED");

    const now = new Date();
    const paymentsBefore = await getLppPayments(tx, input.lipaPolePoleId);
    const summaryBefore = computeLppFinancialSummary({
      agreedTotal: lpp.agreedTotal,
      payments: paymentsBefore,
    });

    if (input.action === "VERIFY") {
      if (payment.amount.gt(summaryBefore.balance))
        throw new Error("LPP_OVERPAYMENT_NOT_ALLOWED");
      await tx.$executeRaw(Prisma.sql`
        UPDATE "LipaPolePolePayment"
        SET "status" = 'SUCCESS', "verifiedAt" = ${now}, "verifiedById" = ${trimToNull(input.reviewedById ?? null)}
        WHERE "id" = ${payment.id}
      `);
    } else {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "LipaPolePolePayment"
        SET "status" = 'FAILED', "rejectedAt" = ${now}, "rejectionReason" = ${rejectionReason}
        WHERE "id" = ${payment.id}
      `);
    }

    const paymentsAfter = await getLppPayments(tx, input.lipaPolePoleId);
    const completion = await updateLppStatusAndCompletion(tx, {
      lpp,
      payments: paymentsAfter,
      now,
    });
    const eventType =
      input.action === "VERIFY" ? "PAYMENT_VERIFIED" : "PAYMENT_REJECTED";
    await writeLppEvent(tx, {
      lipaPolePoleId: input.lipaPolePoleId,
      eventType,
      actorId: input.reviewedById ?? null,
      metadata: {
        paymentId: payment.id,
        amount: payment.amount.toString(),
        reference: payment.reference,
        rejectionReason,
        totalPaid: completion.summary.totalPaid.toString(),
        balance: completion.summary.balance.toString(),
      },
    });
    await writeActionLog(tx, {
      actorId: input.reviewedById ?? null,
      entity: "LipaPolePolePayment",
      entityId: payment.id,
      action: eventType,
      before: { status: payment.status } as Prisma.JsonObject,
      after: {
        status: input.action === "VERIFY" ? "SUCCESS" : "FAILED",
        rejectionReason,
      } as Prisma.JsonObject,
    });

    return {
      paymentId: payment.id,
      lpp: completion.lpp,
      summary: completion.summary,
    };
  });
  if (db === prisma) {
    await safelyDispatchLppLifecycleNotifications({
      lipaPolePoleId: input.lipaPolePoleId,
      paymentId: result.paymentId,
      event:
        input.action === "REJECT"
          ? "PAYMENT_REJECTED"
          : result.summary.isFullyPaid
            ? "PLAN_COMPLETED"
            : "PAYMENT_VERIFIED",
    });
  }
  return result;
}

export async function reverseLppPayment(
  input: ReverseLppPaymentInput,
  db: DbClient = prisma,
) {
  const reversedAt = normalizeOptionalDate(input.reversedAt) ?? new Date();
  const reason = trimToNull(input.reason);
  if (!reason) throw new Error("REVERSAL_REASON_REQUIRED");

  const result = await withLppTransaction(db, async (tx) => {
    const lpp = await lockLppOrThrow(tx, input.lipaPolePoleId);
    if (
      (lpp.convertedReceiptId || lpp.convertedProjectId) &&
      !input.allowConvertedCorrection
    ) {
      throw new Error(
        "LPP_CONVERTED_PAYMENT_REVERSAL_REQUIRES_FINANCIAL_CORRECTION",
      );
    }

    const rows = await (tx as typeof prisma).$queryRaw<
      RawLppPaymentRow[]
    >(Prisma.sql`
      SELECT *
      FROM "LipaPolePolePayment"
      WHERE "id" = ${input.paymentId}
        AND "lipaPolePoleId" = ${input.lipaPolePoleId}
      FOR UPDATE
    `);
    const payment = rows[0] ?? null;
    if (!payment) throw new Error("LPP_PAYMENT_NOT_FOUND");
    if (normalizeLppPaymentStatus(payment.status) !== "SUCCESS") {
      throw new Error("LPP_PAYMENT_NOT_REVERSIBLE");
    }

    await tx.$executeRaw(Prisma.sql`
      UPDATE "LipaPolePolePayment"
      SET
        "status" = ${"REVERSED"}::"LipaPolePolePaymentStatus",
        "reversedAt" = ${reversedAt},
        "reversedById" = ${trimToNull(input.reversedById ?? null)},
        "reversalReason" = ${reason}
      WHERE "id" = ${input.paymentId}
    `);

    const paymentsAfter = await getLppPayments(tx, input.lipaPolePoleId);
    const completion = await updateLppStatusAndCompletion(tx, {
      lpp,
      payments: paymentsAfter,
      now: reversedAt,
    });

    await writeLppEvent(tx, {
      lipaPolePoleId: input.lipaPolePoleId,
      eventType: "PAYMENT_REVERSED",
      actorId: input.reversedById ?? null,
      metadata: {
        paymentId: input.paymentId,
        reason,
        totalPaid: completion.summary.totalPaid.toString(),
        balance: completion.summary.balance.toString(),
      },
    });

    await writeActionLog(tx, {
      actorId: input.reversedById ?? null,
      entity: "LipaPolePole",
      entityId: input.lipaPolePoleId,
      action: "PAYMENT_REVERSED",
      before: {
        paymentId: payment.id,
        paymentStatus: payment.status,
        completedAt: lpp.completedAt?.toISOString() ?? null,
      } as Prisma.JsonObject,
      after: {
        paymentId: payment.id,
        paymentStatus: "REVERSED",
        reason,
        status: completion.lpp.status,
        balance: completion.summary.balance.toString(),
      } as Prisma.JsonObject,
    });

    return {
      lpp: completion.lpp,
      reversedPaymentId: payment.id,
      summary: completion.summary,
    };
  });
  if (db === prisma) {
    await safelyDispatchLppLifecycleNotifications({
      lipaPolePoleId: input.lipaPolePoleId,
      paymentId: result.reversedPaymentId,
      event: "PAYMENT_REVERSED",
    });
  }
  return result;
}

export async function completeLipaPolePole(
  lipaPolePoleId: string,
  db: DbClient = prisma,
): Promise<CompletionResult> {
  return withLppTransaction(db, async (tx) => {
    const lpp = await lockLppOrThrow(tx, lipaPolePoleId);
    const payments = await getLppPayments(tx, lipaPolePoleId);
    const completion = await updateLppStatusAndCompletion(tx, {
      lpp,
      payments,
      now: new Date(),
    });
    if (!completion.summary.isFullyPaid) {
      throw new Error("LPP_BALANCE_NOT_ZERO");
    }
    if (
      !["COMPLETED", "AWAITING_CONVERSION"].includes(
        normalizeLppStatus(completion.lpp.status),
      )
    ) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "LipaPolePole"
        SET
          "status" = ${"AWAITING_CONVERSION"}::"LipaPolePoleStatus",
          "completedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${lipaPolePoleId}
      `);
    }
    const refreshed = await getLppById(tx, lipaPolePoleId);
    if (!refreshed) throw new Error("LPP_NOT_FOUND_AFTER_COMPLETE");
    return {
      lpp: refreshed,
      summary: completion.summary,
    };
  });
}

export async function convertLppToPos(
  input: ConvertLppToPosInput,
  db: DbClient = prisma,
) {
  const receiptId = trimToNull(input.receiptId);
  if (!receiptId) throw new Error("RECEIPT_ID_REQUIRED");

  return withLppTransaction(db, async (tx) => {
    const lpp = await lockLppOrThrow(tx, input.lipaPolePoleId);
    const payments = await getLppPayments(tx, input.lipaPolePoleId);
    const completion = await updateLppStatusAndCompletion(tx, {
      lpp,
      payments,
      now: new Date(),
    });

    if (completion.lpp.convertedReceiptId === receiptId) {
      return completion.lpp;
    }
    if (
      completion.lpp.convertedReceiptId ||
      completion.lpp.convertedProjectId
    ) {
      throw new Error("LPP_ALREADY_CONVERTED");
    }

    ensureLppEligibleForConversion(completion.lpp, completion.summary);

    const convertedAt = new Date();
    await tx.$executeRaw(Prisma.sql`
      UPDATE "LipaPolePole"
      SET
        "status" = ${"CONVERTED_TO_POS"}::"LipaPolePoleStatus",
        "convertedAt" = ${convertedAt},
        "convertedById" = ${trimToNull(input.convertedById ?? null)},
        "convertedReceiptId" = ${receiptId},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${input.lipaPolePoleId}
    `);

    await writeLppEvent(tx, {
      lipaPolePoleId: input.lipaPolePoleId,
      eventType: "CONVERTED_TO_POS",
      actorId: input.convertedById ?? null,
      metadata: {
        receiptId,
        reference: completion.lpp.reference,
      },
    });

    await writeActionLog(tx, {
      actorId: input.convertedById ?? null,
      entity: "LipaPolePole",
      entityId: input.lipaPolePoleId,
      action: "CONVERT_TO_POS",
      before: {
        status: completion.lpp.status,
        convertedReceiptId: completion.lpp.convertedReceiptId,
        convertedProjectId: completion.lpp.convertedProjectId,
      } as Prisma.JsonObject,
      after: {
        status: "CONVERTED_TO_POS",
        convertedReceiptId: receiptId,
      } as Prisma.JsonObject,
    });

    const refreshed = await getLppById(tx, input.lipaPolePoleId);
    if (!refreshed) throw new Error("LPP_NOT_FOUND_AFTER_CONVERSION");
    return refreshed;
  });
}

export async function convertLppToProject(
  input: ConvertLppToProjectInput,
  db: DbClient = prisma,
) {
  const projectId = trimToNull(input.projectId);
  if (!projectId) throw new Error("PROJECT_ID_REQUIRED");

  return withLppTransaction(db, async (tx) => {
    const lpp = await lockLppOrThrow(tx, input.lipaPolePoleId);
    const payments = await getLppPayments(tx, input.lipaPolePoleId);
    const completion = await updateLppStatusAndCompletion(tx, {
      lpp,
      payments,
      now: new Date(),
    });

    if (completion.lpp.convertedProjectId === projectId) {
      return completion.lpp;
    }
    if (
      completion.lpp.convertedReceiptId ||
      completion.lpp.convertedProjectId
    ) {
      throw new Error("LPP_ALREADY_CONVERTED");
    }

    ensureLppEligibleForConversion(completion.lpp, completion.summary);

    const convertedAt = new Date();
    await tx.$executeRaw(Prisma.sql`
      UPDATE "LipaPolePole"
      SET
        "status" = ${"CONVERTED_TO_PROJECT"}::"LipaPolePoleStatus",
        "convertedAt" = ${convertedAt},
        "convertedById" = ${trimToNull(input.convertedById ?? null)},
        "convertedProjectId" = ${projectId},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${input.lipaPolePoleId}
    `);

    await writeLppEvent(tx, {
      lipaPolePoleId: input.lipaPolePoleId,
      eventType: "CONVERTED_TO_PROJECT",
      actorId: input.convertedById ?? null,
      metadata: {
        projectId,
        reference: completion.lpp.reference,
      },
    });

    await writeActionLog(tx, {
      actorId: input.convertedById ?? null,
      entity: "LipaPolePole",
      entityId: input.lipaPolePoleId,
      action: "CONVERT_TO_PROJECT",
      before: {
        status: completion.lpp.status,
        convertedReceiptId: completion.lpp.convertedReceiptId,
        convertedProjectId: completion.lpp.convertedProjectId,
      } as Prisma.JsonObject,
      after: {
        status: "CONVERTED_TO_PROJECT",
        convertedProjectId: projectId,
      } as Prisma.JsonObject,
    });

    const refreshed = await getLppById(tx, input.lipaPolePoleId);
    if (!refreshed) throw new Error("LPP_NOT_FOUND_AFTER_CONVERSION");
    return refreshed;
  });
}

export async function releaseLppProduct(
  input: ReleaseLppProductInput,
  db: DbClient = prisma,
) {
  const fulfillmentMethod = trimToNull(input.fulfillmentMethod);
  if (!fulfillmentMethod) throw new Error("FULFILLMENT_METHOD_REQUIRED");

  const released = await withLppTransaction(db, async (tx) => {
    const lpp = await lockLppOrThrow(tx, input.lipaPolePoleId);
    if (lpp.fulfilledAt) throw new Error("LPP_ALREADY_FULFILLED");

    const payments = await getLppPayments(tx, input.lipaPolePoleId);
    const transactionFullyPaid = await isLppFinalTransactionFullyPaid(lpp, tx);

    assertLppEligibleForRelease({
      agreedTotal: lpp.agreedTotal,
      payments,
      converted: Boolean(lpp.convertedReceiptId || lpp.convertedProjectId),
      transactionFullyPaid,
    });

    const fulfilledAt = normalizeOptionalDate(input.fulfilledAt) ?? new Date();

    await tx.$executeRaw(Prisma.sql`
      UPDATE "LipaPolePole"
      SET
        "status" = ${"CLOSED"}::"LipaPolePoleStatus",
        "fulfilledAt" = ${fulfilledAt},
        "fulfilledById" = ${trimToNull(input.fulfilledById ?? null)},
        "fulfillmentMethod" = ${fulfillmentMethod},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${input.lipaPolePoleId}
    `);

    await writeLppEvent(tx, {
      lipaPolePoleId: input.lipaPolePoleId,
      eventType: "PRODUCT_RELEASED",
      actorId: input.fulfilledById ?? null,
      metadata: {
        fulfillmentMethod,
        collectorName: trimToNull(input.collectorName ?? null),
        collectorReference: trimToNull(input.collectorReference ?? null),
        notes: trimToNull(input.notes ?? null),
        convertedReceiptId: lpp.convertedReceiptId,
        convertedProjectId: lpp.convertedProjectId,
      },
    });

    await writeActionLog(tx, {
      actorId: input.fulfilledById ?? null,
      entity: "LipaPolePole",
      entityId: input.lipaPolePoleId,
      action: "RELEASE_PRODUCT",
      before: {
        status: lpp.status,
        fulfilledAt: null,
        fulfillmentMethod: lpp.fulfillmentMethod,
      } as Prisma.JsonObject,
      after: {
        status: "CLOSED",
        fulfilledAt: fulfilledAt.toISOString(),
        fulfillmentMethod,
        collectorName: trimToNull(input.collectorName ?? null),
        collectorReference: trimToNull(input.collectorReference ?? null),
      } as Prisma.JsonObject,
    });

    const refreshed = await getLppById(tx, input.lipaPolePoleId);
    if (!refreshed) throw new Error("LPP_NOT_FOUND_AFTER_RELEASE");
    return refreshed;
  });
  if (db === prisma) {
    await safelyDispatchLppLifecycleNotifications({
      lipaPolePoleId: input.lipaPolePoleId,
      event: "PRODUCT_RELEASED",
    });
  }
  return released;
}

export async function createLppFollowUp(
  input: CreateLppFollowUpInput,
  db: DbClient = prisma,
) {
  const taskType = trimToNull(input.taskType);
  if (!taskType) throw new Error("FOLLOW_UP_TASK_TYPE_REQUIRED");

  return withLppTransaction(db, async (tx) => {
    const lpp = await getLppById(tx, input.lipaPolePoleId);
    if (!lpp) throw new Error("LPP_NOT_FOUND");

    const assignedToId =
      trimToNull(input.assignedToId ?? null) ?? lpp.assignedToId;
    const taskDate = normalizeOptionalDate(input.taskDate) ?? null;
    const id = randomUUID();

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "LipaPolePoleFollowUp" (
        "id", "lipaPolePoleId", "assignedToId", "outcome", "taskType", "taskDate", "notes", "createdById", "createdAt", "updatedAt"
      ) VALUES (
        ${id},
        ${input.lipaPolePoleId},
        ${assignedToId},
        ${trimToNull(input.outcome ?? null)},
        ${taskType},
        ${taskDate},
        ${trimToNull(input.notes ?? null)},
        ${trimToNull(input.createdById ?? null)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);

    await writeLppEvent(tx, {
      lipaPolePoleId: input.lipaPolePoleId,
      eventType: "FOLLOWUP_RECORDED",
      actorId: input.createdById ?? null,
      metadata: {
        followUpId: id,
        taskType,
        taskDate: taskDate?.toISOString() ?? null,
        assignedToId,
        outcome: trimToNull(input.outcome ?? null),
      },
    });

    const followUps = await getLppFollowUps(tx, input.lipaPolePoleId);
    return serializeLppFollowUp(
      followUps.find((row) => row.id === id) ?? followUps[0],
    );
  });
}

export async function createLppPromise(
  input: CreateLppPromiseInput,
  db: DbClient = prisma,
) {
  const promiseDate = normalizeOptionalDate(input.promiseDate);
  if (!promiseDate) throw new Error("PROMISE_DATE_REQUIRED");
  const promiseAmount = toMoney(input.promiseAmount);
  if (promiseAmount.lte(0)) throw new Error("INVALID_PROMISE_AMOUNT");

  return withLppTransaction(db, async (tx) => {
    const lpp = await getLppById(tx, input.lipaPolePoleId);
    if (!lpp) throw new Error("LPP_NOT_FOUND");

    const id = randomUUID();
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "LipaPolePolePromise" (
        "id", "lipaPolePoleId", "promiseAmount", "promiseDate", "status", "notes", "createdById", "createdAt", "updatedAt"
      ) VALUES (
        ${id},
        ${input.lipaPolePoleId},
        ${promiseAmount},
        ${promiseDate},
        ${"ACTIVE"},
        ${trimToNull(input.notes ?? null)},
        ${trimToNull(input.createdById ?? null)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);

    await writeLppEvent(tx, {
      lipaPolePoleId: input.lipaPolePoleId,
      eventType: "PROMISE_CREATED",
      actorId: input.createdById ?? null,
      metadata: {
        promiseId: id,
        promiseAmount: promiseAmount.toString(),
        promiseDate: promiseDate.toISOString(),
      },
    });

    const promises = await getLppPromises(tx, input.lipaPolePoleId);
    return serializeLppPromise(
      promises.find((row) => row.id === id) ?? promises[0],
    );
  });
}

export async function createLppReminderRecord(
  input: {
    lipaPolePoleId: string;
    reminderType: string;
    dueDate: Date | string;
    scheduledFor: Date | string;
    channel: string;
    payloadSnapshot?: Record<string, Prisma.JsonValue> | null;
  },
  db: DbClient = prisma,
) {
  const idempotencyKey = buildLppReminderIdempotencyKey({
    lppId: input.lipaPolePoleId,
    reminderType: input.reminderType,
    dueDate: input.dueDate,
    channel: input.channel,
  });

  const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "LipaPolePoleReminder" (
      "id", "lipaPolePoleId", "reminderType", "scheduledFor", "channel", "status", "idempotencyKey", "payloadSnapshot", "createdAt"
    ) VALUES (
      ${randomUUID()},
      ${input.lipaPolePoleId},
      ${trimToNull(input.reminderType) ?? "REMINDER"},
      ${normalizeOptionalDate(input.scheduledFor) ?? new Date()},
      ${trimToNull(input.channel) ?? "INTERNAL"},
      'PENDING',
      ${idempotencyKey},
      ${(input.payloadSnapshot ?? null) as Prisma.JsonObject | null},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("idempotencyKey") DO NOTHING
    RETURNING "id"
  `);

  return {
    idempotencyKey,
    created: Boolean(rows[0]?.id),
    id: rows[0]?.id ?? null,
  };
}

async function updateLppReminderDeliveryState(
  db: DbClient,
  input: {
    idempotencyKey: string;
    status: "SENT" | "FAILED" | "SKIPPED";
    providerMessageId?: string | null;
    payloadSnapshot?: Record<string, Prisma.JsonValue> | null;
    sentAt?: Date | null;
  },
) {
  await db.$executeRaw(Prisma.sql`
    UPDATE "LipaPolePoleReminder"
    SET
      "status" = ${input.status},
      "providerMessageId" = ${trimToNull(input.providerMessageId ?? null)},
      "payloadSnapshot" = ${(input.payloadSnapshot ?? null) as Prisma.JsonObject | null},
      "sentAt" = ${
        input.status === "SENT"
          ? (input.sentAt ?? new Date())
          : input.sentAt === undefined
            ? Prisma.raw(`"sentAt"`)
            : input.sentAt
      }
    WHERE "idempotencyKey" = ${input.idempotencyKey}
  `);
}

type LppLifecycleDispatchInput = {
  lipaPolePoleId: string;
  event: LppLifecycleEvent;
  paymentId?: string | null;
};

async function dispatchLppLifecycleNotifications(
  input: LppLifecycleDispatchInput,
) {
  const rows = await prisma.$queryRaw<
    Array<{
      reference: string;
      currency: string;
      agreedTotal: Prisma.Decimal;
      expectedCompletionDate: Date | null;
      createdAt: Date;
      customerName: string | null;
      customerPhone: string | null;
      customerEmail: string | null;
      agentName: string | null;
      agentPhone: string | null;
      agentEmail: string | null;
      productName: string | null;
      totalPaid: Prisma.Decimal;
      paymentAmount: Prisma.Decimal | null;
      paymentReference: string | null;
      paymentReason: string | null;
      nextInstallmentDate: Date | null;
      nextInstallmentAmount: Prisma.Decimal | null;
    }>
  >(Prisma.sql`
    SELECT
      lpp."reference",
      lpp."currency",
      lpp."agreedTotal",
      lpp."expectedCompletionDate",
      lpp."createdAt",
      customer."name" AS "customerName",
      customer."phone" AS "customerPhone",
      customer."email" AS "customerEmail",
      agent."name" AS "agentName",
      agent."phone" AS "agentPhone",
      agent."email" AS "agentEmail",
      COALESCE(NULLIF(lpp."customProductName", ''), product."name") AS "productName",
      COALESCE(payment_totals."totalPaid", 0)::numeric AS "totalPaid",
      event_payment."amount" AS "paymentAmount",
      event_payment."reference" AS "paymentReference",
      COALESCE(event_payment."rejectionReason", event_payment."reversalReason") AS "paymentReason",
      next_installment."dueDate" AS "nextInstallmentDate",
      next_installment."expectedAmount" AS "nextInstallmentAmount"
    FROM "LipaPolePole" lpp
    INNER JOIN "User" customer ON customer."id" = lpp."customerId"
    LEFT JOIN "User" agent ON agent."id" = lpp."assignedToId"
    LEFT JOIN "Product" product ON product."id" = lpp."productId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(payment."amount"), 0)::numeric AS "totalPaid"
      FROM "LipaPolePolePayment" payment
      WHERE payment."lipaPolePoleId" = lpp."id" AND payment."status" = 'SUCCESS'
    ) payment_totals ON TRUE
    LEFT JOIN "LipaPolePolePayment" event_payment
      ON event_payment."id" = ${trimToNull(input.paymentId ?? null)}
      AND event_payment."lipaPolePoleId" = lpp."id"
    LEFT JOIN LATERAL (
      SELECT installment."dueDate", installment."expectedAmount"
      FROM "LipaPolePoleInstallment" installment
      WHERE installment."lipaPolePoleId" = lpp."id"
        AND installment."dueDate" >= CURRENT_DATE
      ORDER BY installment."dueDate" ASC
      LIMIT 1
    ) next_installment ON TRUE
    WHERE lpp."id" = ${input.lipaPolePoleId}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return;

  const totalPaid = Number(row.totalPaid ?? 0);
  const agreedTotal = Number(row.agreedTotal ?? 0);
  const baseUrl = String(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.APP_URL ||
      "https://www.betech.co.ke",
  ).replace(/\/$/, "");
  const opsUrl = String(
    process.env.NEXT_PUBLIC_OPS_URL || "https://ops.betech.co.ke",
  ).replace(/\/$/, "");
  const baseContext: Omit<LppLifecycleNotificationContext, "recipient"> = {
    event: input.event,
    reference: row.reference,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    agentName: row.agentName,
    agentPhone: row.agentPhone,
    agentEmail: row.agentEmail,
    productName: row.productName,
    dueDate: row.expectedCompletionDate,
    agreedTotal,
    totalPaid,
    balance: Math.max(0, agreedTotal - totalPaid),
    currency: row.currency,
    paymentAmount: row.paymentAmount == null ? null : Number(row.paymentAmount),
    paymentReference:
      row.paymentReference == null
        ? null
        : (extractMpesaTransactionCode(row.paymentReference) ??
          row.paymentReference),
    reason: row.paymentReason,
    nextInstallmentDate: row.nextInstallmentDate,
    nextInstallmentAmount:
      row.nextInstallmentAmount == null
        ? null
        : Number(row.nextInstallmentAmount),
    accountUrl: `${baseUrl}/shop/account/lipa-pole-pole/${encodeURIComponent(input.lipaPolePoleId)}`,
    adminUrl: `${opsUrl}/admin/lipa-pole-pole?id=${encodeURIComponent(input.lipaPolePoleId)}`,
  };
  const recipients: LppLifecycleRecipient[] = ["CUSTOMER"];
  if (
    ["ACCOUNT_CREATED", "PAYMENT_SUBMITTED"].includes(input.event) &&
    (row.agentPhone || row.agentEmail)
  ) {
    recipients.push("ASSIGNED_AGENT");
  }

  const deliveries = recipients.flatMap((recipient) =>
    (["SMS", "EMAIL"] as const).map((channel) => ({ recipient, channel })),
  );

  await Promise.all(
    deliveries.map(async ({ recipient, channel }) => {
      const reminderType = [
        "LIFECYCLE",
        input.event,
        input.paymentId || "ACCOUNT",
        recipient,
      ].join("_");
      const reminder = await createLppReminderRecord({
        lipaPolePoleId: input.lipaPolePoleId,
        reminderType,
        dueDate: row.createdAt,
        scheduledFor: new Date(),
        channel,
        payloadSnapshot: { event: input.event, recipient, channel },
      });
      if (!reminder.created) return;

      const result = await sendLppLifecycleChannelNotification(
        { ...baseContext, recipient },
        channel,
      );
      await updateLppReminderDeliveryState(prisma, {
        idempotencyKey: reminder.idempotencyKey,
        status: result.status,
        providerMessageId: result.providerMessageId,
        sentAt: result.status === "SENT" ? new Date() : null,
        payloadSnapshot: {
          event: input.event,
          recipient,
          channel,
          resultStatus: result.status,
          error: result.error,
          ...(result.payloadSnapshot as Record<string, Prisma.JsonValue>),
        },
      });
      await writeLppEvent(prisma, {
        lipaPolePoleId: input.lipaPolePoleId,
        eventType: `NOTIFICATION_${result.status}`,
        actorId: null,
        metadata: {
          lifecycleEvent: input.event,
          recipient,
          channel,
          providerMessageId: result.providerMessageId,
          error: result.error,
        },
      });
    }),
  );
}

async function safelyDispatchLppLifecycleNotifications(
  input: LppLifecycleDispatchInput,
) {
  try {
    await dispatchLppLifecycleNotifications(input);
  } catch (error) {
    console.error("[lpp notifications] lifecycle dispatch failed", {
      ...input,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getLppAccountSummary(
  lipaPolePoleId: string,
  db: DbClient = prisma,
) {
  const lpp = await getLppById(db, lipaPolePoleId);
  if (!lpp) throw new Error("LPP_NOT_FOUND");
  const payments = await getLppPayments(db, lipaPolePoleId);
  const items = await getLppItems(db, lipaPolePoleId);
  const summary = computeLppFinancialSummary({
    agreedTotal: lpp.agreedTotal,
    payments,
  });
  return { lpp, payments, items, summary };
}

function serializeLppItem(row: RawLppItemRow): SerializedLppItem {
  return {
    id: row.id,
    productId: row.productId ?? null,
    description: row.description,
    quantity: Number(row.quantity ?? 1),
    unitPrice: Number(row.unitPrice ?? 0),
    total: Number(row.total ?? 0),
    serial: row.serial ?? null,
    warranty: row.warranty ?? null,
    position: Number(row.position ?? 0),
  };
}

function serializeLppPayment(row: RawLppPaymentRow): SerializedLppPayment {
  const reference =
    row.method === "MPESA"
      ? (extractMpesaTransactionCode(row.reference) ?? row.reference ?? null)
      : (row.reference ?? null);
  return {
    id: row.id,
    amount: Number(row.amount ?? 0),
    method: row.method,
    reference,
    status: row.status,
    receivedById: row.receivedById ?? null,
    receivedAt: row.receivedAt.toISOString(),
    notes: row.notes ?? null,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    verifiedById: row.verifiedById ?? null,
    rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : null,
    rejectionReason: row.rejectionReason ?? null,
    reversedAt: row.reversedAt ? row.reversedAt.toISOString() : null,
    reversalReason: row.reversalReason ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeLppEvent(row: RawLppEventRow): SerializedLppEvent {
  return {
    id: row.id,
    eventType: row.eventType,
    actorId: row.actorId ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeLppReminder(row: RawLppReminderRow): SerializedLppReminder {
  return {
    id: row.id,
    reminderType: row.reminderType,
    scheduledFor: row.scheduledFor.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    channel: row.channel,
    status: row.status,
    providerMessageId: row.providerMessageId ?? null,
    idempotencyKey: row.idempotencyKey,
    payloadSnapshot: row.payloadSnapshot ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeLppFollowUp(row: RawLppFollowUpRow): SerializedLppFollowUp {
  return {
    id: row.id,
    assignedToId: row.assignedToId ?? null,
    assignedToName: row.assignedToName ?? null,
    outcome: row.outcome ?? null,
    taskType: row.taskType,
    taskDate: row.taskDate ? row.taskDate.toISOString() : null,
    notes: row.notes ?? null,
    createdById: row.createdById ?? null,
    createdByName: row.createdByName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeLppPromise(row: RawLppPromiseRow): SerializedLppPromise {
  return {
    id: row.id,
    promiseAmount: Number(row.promiseAmount ?? 0),
    promiseDate: row.promiseDate.toISOString(),
    status: row.status,
    notes: row.notes ?? null,
    createdById: row.createdById ?? null,
    createdByName: row.createdByName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeLppInstallment(
  row: RawLppInstallmentRow,
): SerializedLppInstallment {
  return {
    id: row.id,
    dueDate: row.dueDate.toISOString(),
    expectedAmount: Number(row.expectedAmount ?? 0),
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getSerializedLppAccountDetail(
  lipaPolePoleId: string,
  db: DbClient = prisma,
) {
  const { lpp, payments, items, summary } = await getLppAccountSummary(
    lipaPolePoleId,
    db,
  );
  const rows = await db.$queryRaw<
    Array<{
      customerName: string | null;
      customerPhone: string | null;
      customerEmail: string | null;
      customerCounty: string | null;
      customerTown: string | null;
      customerEstateLandmark: string | null;
      customerLocationNotes: string | null;
      productName: string | null;
      assignedToName: string | null;
      salespersonName: string | null;
      fulfilledByName: string | null;
    }>
  >(Prisma.sql`
    SELECT
      c."name" AS "customerName",
      c."phone" AS "customerPhone",
      c."email" AS "customerEmail",
      c."county" AS "customerCounty",
      c."town" AS "customerTown",
      c."estateLandmark" AS "customerEstateLandmark",
      c."locationNotes" AS "customerLocationNotes",
      COALESCE(NULLIF(lpp."customProductName", ''), p."name") AS "productName",
      a."name" AS "assignedToName",
      s."name" AS "salespersonName",
      f."name" AS "fulfilledByName"
    FROM "LipaPolePole" lpp
    LEFT JOIN "User" c ON c."id" = lpp."customerId"
    LEFT JOIN "Product" p ON p."id" = lpp."productId"
    LEFT JOIN "User" a ON a."id" = lpp."assignedToId"
    LEFT JOIN "User" s ON s."id" = lpp."salespersonId"
    LEFT JOIN "User" f ON f."id" = lpp."fulfilledById"
    WHERE lpp."id" = ${lipaPolePoleId}
    LIMIT 1
  `);
  const meta = rows[0] ?? {
    customerName: null,
    customerPhone: null,
    customerEmail: null,
    customerCounty: null,
    customerTown: null,
    customerEstateLandmark: null,
    customerLocationNotes: null,
    productName: null,
    assignedToName: null,
    salespersonName: null,
    fulfilledByName: null,
  };
  const events = await getLppEvents(db, lipaPolePoleId);
  const reminders = await getLppReminders(db, lipaPolePoleId);
  const followUps = await getLppFollowUps(db, lipaPolePoleId);
  const promises = await getLppPromises(db, lipaPolePoleId);
  const installments = await getLppInstallments(db, lipaPolePoleId);

  const account: SerializedLppAccount = {
    id: lpp.id,
    reference: lpp.reference,
    customerId: lpp.customerId,
    customerName: meta.customerName,
    customerPhone: meta.customerPhone,
    customerEmail: meta.customerEmail,
    customerCounty: meta.customerCounty,
    customerTown: meta.customerTown,
    customerEstateLandmark: meta.customerEstateLandmark,
    customerLocationNotes: meta.customerLocationNotes,
    productId: lpp.productId,
    productName: meta.productName,
    itemSerial: lpp.itemSerial ?? null,
    itemWarranty: lpp.itemWarranty ?? null,
    termsAcceptedAt: lpp.termsAcceptedAt
      ? lpp.termsAcceptedAt.toISOString()
      : null,
    termsVersion: lpp.termsVersion ?? null,
    quantity: Number(lpp.quantity ?? 1),
    agreedUnitPrice: Number(lpp.agreedUnitPrice ?? 0),
    assignedToId: lpp.assignedToId,
    assignedToName: meta.assignedToName,
    salespersonId: lpp.salespersonId ?? null,
    salespersonName: meta.salespersonName,
    agreedTotal: Number(lpp.agreedTotal ?? 0),
    totalPaid: Number(summary.totalPaid ?? 0),
    balance: Number(summary.balance ?? 0),
    percentagePaid: Number(summary.percentagePaid ?? 0),
    status: deriveLppOperationalStatus({
      currentStatus: lpp.status,
      agreedTotal: lpp.agreedTotal,
      payments,
      expectedCompletionDate: lpp.expectedCompletionDate,
      convertedReceiptId: lpp.convertedReceiptId,
      convertedProjectId: lpp.convertedProjectId,
      fulfilledAt: lpp.fulfilledAt,
    }),
    paymentMode: lpp.paymentMode,
    reservationMode: lpp.reservationMode,
    source: lpp.source ?? null,
    expectedCompletionDate: lpp.expectedCompletionDate
      ? lpp.expectedCompletionDate.toISOString()
      : null,
    createdAt: lpp.createdAt.toISOString(),
    updatedAt: lpp.updatedAt.toISOString(),
    completedAt: lpp.completedAt ? lpp.completedAt.toISOString() : null,
    convertedAt: lpp.convertedAt ? lpp.convertedAt.toISOString() : null,
    convertedReceiptId: lpp.convertedReceiptId ?? null,
    convertedProjectId: lpp.convertedProjectId ?? null,
    fulfilledAt: lpp.fulfilledAt ? lpp.fulfilledAt.toISOString() : null,
    fulfilledById: lpp.fulfilledById ?? null,
    fulfilledByName: meta.fulfilledByName,
    fulfillmentMethod: lpp.fulfillmentMethod ?? null,
  };

  return {
    account,
    items: items.map(serializeLppItem),
    payments: payments.map(serializeLppPayment),
    events: events.map(serializeLppEvent),
    reminders: reminders.map(serializeLppReminder),
    followUps: followUps.map(serializeLppFollowUp),
    promises: promises.map(serializeLppPromise),
    installments: installments.map(serializeLppInstallment),
    summary: {
      agreedTotal: Number(summary.agreedTotal ?? 0),
      totalPaid: Number(summary.totalPaid ?? 0),
      balance: Number(summary.balance ?? 0),
      percentagePaid: Number(summary.percentagePaid ?? 0),
      isFullyPaid: summary.isFullyPaid,
    },
  };
}

export async function listSerializedLppAccounts(
  input?: {
    q?: string;
    status?: string | null;
    assignedToId?: string | null;
    customerId?: string | null;
    take?: number;
  },
  db: DbClient = prisma,
) {
  const q = trimToNull(input?.q ?? null);
  const status = trimToNull(input?.status ?? null);
  const assignedToId = trimToNull(input?.assignedToId ?? null);
  const customerId = trimToNull(input?.customerId ?? null);
  const take = Math.min(200, Math.max(1, Number(input?.take ?? 100)));

  const rows = await db.$queryRaw<
    Array<
      RawLppRow & {
        customerName: string | null;
        customerPhone: string | null;
        customerEmail: string | null;
        productName: string | null;
        assignedToName: string | null;
        salespersonName: string | null;
      }
    >
  >(Prisma.sql`
    SELECT
      lpp.*,
      c."name" AS "customerName",
      c."phone" AS "customerPhone",
      c."email" AS "customerEmail",
      COALESCE(NULLIF(lpp."customProductName", ''), p."name") AS "productName",
      a."name" AS "assignedToName",
      s."name" AS "salespersonName"
    FROM "LipaPolePole" lpp
    LEFT JOIN "User" c ON c."id" = lpp."customerId"
    LEFT JOIN "Product" p ON p."id" = lpp."productId"
    LEFT JOIN "User" a ON a."id" = lpp."assignedToId"
    LEFT JOIN "User" s ON s."id" = lpp."salespersonId"
    WHERE 1 = 1
      ${status ? Prisma.sql`AND lpp."status"::text = ${status}` : Prisma.empty}
      ${assignedToId ? Prisma.sql`AND lpp."assignedToId" = ${assignedToId}` : Prisma.empty}
      ${customerId ? Prisma.sql`AND lpp."customerId" = ${customerId}` : Prisma.empty}
      ${
        q
          ? Prisma.sql`AND (
              lpp."reference" ILIKE ${`%${q}%`}
              OR COALESCE(c."name", '') ILIKE ${`%${q}%`}
              OR COALESCE(c."phone", '') ILIKE ${`%${q}%`}
              OR COALESCE(NULLIF(lpp."customProductName", ''), p."name", '') ILIKE ${`%${q}%`}
            )`
          : Prisma.empty
      }
    ORDER BY lpp."updatedAt" DESC, lpp."createdAt" DESC
    LIMIT ${take}
  `);

  const paymentAgg = await db.$queryRaw<
    Array<{
      lipaPolePoleId: string;
      totalPaid: Prisma.Decimal;
    }>
  >(Prisma.sql`
    SELECT "lipaPolePoleId", COALESCE(SUM("amount"), 0)::numeric AS "totalPaid"
    FROM "LipaPolePolePayment"
    WHERE "status" = 'SUCCESS'
      AND "lipaPolePoleId" IN (${Prisma.join(rows.map((row) => row.id).length ? rows.map((row) => row.id) : [""])})
    GROUP BY "lipaPolePoleId"
  `);
  const totalPaidById = new Map(
    paymentAgg.map((row) => [row.lipaPolePoleId, Number(row.totalPaid ?? 0)]),
  );

  return rows.map((row) => {
    const totalPaid = totalPaidById.get(row.id) ?? 0;
    const agreedTotal = Number(row.agreedTotal ?? 0);
    const balance = Math.max(0, agreedTotal - totalPaid);
    const percentagePaid =
      agreedTotal > 0
        ? Math.min(100, Math.round((totalPaid / agreedTotal) * 10000) / 100)
        : 0;
    const derivedStatus = deriveLppOperationalStatus({
      currentStatus: row.status,
      agreedTotal,
      payments: totalPaid > 0 ? [{ amount: totalPaid, status: "SUCCESS" }] : [],
      expectedCompletionDate: row.expectedCompletionDate,
      convertedReceiptId: row.convertedReceiptId,
      convertedProjectId: row.convertedProjectId,
      fulfilledAt: row.fulfilledAt,
    });
    return {
      id: row.id,
      reference: row.reference,
      customerId: row.customerId,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      customerEmail: row.customerEmail,
      customerCounty: null,
      customerTown: null,
      customerEstateLandmark: null,
      customerLocationNotes: null,
      productId: row.productId,
      productName: row.productName,
      itemSerial: row.itemSerial ?? null,
      itemWarranty: row.itemWarranty ?? null,
      termsAcceptedAt: row.termsAcceptedAt
        ? row.termsAcceptedAt.toISOString()
        : null,
      termsVersion: row.termsVersion ?? null,
      quantity: Number(row.quantity ?? 1),
      agreedUnitPrice: Number(row.agreedUnitPrice ?? 0),
      assignedToId: row.assignedToId,
      assignedToName: row.assignedToName,
      salespersonId: row.salespersonId ?? null,
      salespersonName: row.salespersonName,
      agreedTotal,
      totalPaid,
      balance,
      percentagePaid,
      status: derivedStatus,
      paymentMode: row.paymentMode,
      reservationMode: row.reservationMode,
      source: row.source ?? null,
      expectedCompletionDate: row.expectedCompletionDate
        ? row.expectedCompletionDate.toISOString()
        : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      convertedAt: row.convertedAt ? row.convertedAt.toISOString() : null,
      convertedReceiptId: row.convertedReceiptId ?? null,
      convertedProjectId: row.convertedProjectId ?? null,
      fulfilledAt: row.fulfilledAt ? row.fulfilledAt.toISOString() : null,
      fulfilledById: row.fulfilledById ?? null,
      fulfilledByName: null,
      fulfillmentMethod: row.fulfillmentMethod ?? null,
    } satisfies SerializedLppAccount;
  });
}

function normalizeReminderDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function ensureSystemLppFollowUpTask(
  db: DbClient,
  input: {
    lipaPolePoleId: string;
    assignedToId?: string | null;
    taskType: string;
    taskDate: Date;
    notes?: string | null;
  },
) {
  const existing = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "LipaPolePoleFollowUp"
    WHERE "lipaPolePoleId" = ${input.lipaPolePoleId}
      AND "taskType" = ${input.taskType}
      AND DATE(COALESCE("taskDate", "createdAt")) = DATE(${input.taskDate})
    LIMIT 1
  `);
  if (existing[0]?.id) return false;

  await db.$executeRaw(Prisma.sql`
    INSERT INTO "LipaPolePoleFollowUp" (
      "id", "lipaPolePoleId", "assignedToId", "taskType", "taskDate", "notes", "createdById", "createdAt", "updatedAt"
    ) VALUES (
      ${randomUUID()},
      ${input.lipaPolePoleId},
      ${trimToNull(input.assignedToId ?? null)},
      ${input.taskType},
      ${input.taskDate},
      ${trimToNull(input.notes ?? null)},
      NULL,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);
  return true;
}

export async function processDueLppReminders(
  input?: { limit?: number; dryRun?: boolean; now?: Date },
  db: DbClient = prisma,
): Promise<ProcessLppReminderSummary> {
  const now = input?.now ?? new Date();
  const limit = Math.min(250, Math.max(1, Number(input?.limit ?? 100)));
  const rows = await db.$queryRaw<RawLppRow[]>(Prisma.sql`
    SELECT *
    FROM "LipaPolePole"
    WHERE "expectedCompletionDate" IS NOT NULL
      AND "fulfilledAt" IS NULL
      AND "status"::text IN ('ACTIVE', 'DUE_SOON', 'OVERDUE', 'COMPLETED', 'AWAITING_CONVERSION')
    ORDER BY "expectedCompletionDate" ASC, "updatedAt" DESC
    LIMIT ${limit}
  `);

  const summary: ProcessLppReminderSummary = {
    scanned: rows.length,
    reminderRecordsCreated: 0,
    followUpsCreated: 0,
    promisesBroken: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
    notificationsSkipped: 0,
    results: [],
  };

  const dayOffsets = [
    { days: 7, type: "REMINDER_7_DAYS", taskType: "FOLLOW_UP_7_DAYS" },
    { days: 3, type: "REMINDER_3_DAYS", taskType: "FOLLOW_UP_3_DAYS" },
    { days: 0, type: "DUE_TODAY", taskType: "PAYMENT_DUE_TODAY" },
    { days: -1, type: "OVERDUE_1_DAY", taskType: "PAYMENT_OVERDUE_1_DAY" },
    { days: -3, type: "OVERDUE_3_DAYS", taskType: "PAYMENT_OVERDUE_3_DAYS" },
    { days: -7, type: "OVERDUE_7_DAYS", taskType: "PAYMENT_OVERDUE_7_DAYS" },
    { days: -14, type: "OVERDUE_14_DAYS", taskType: "PAYMENT_OVERDUE_14_DAYS" },
  ] as const;

  for (const lpp of rows) {
    const payments = await getLppPayments(db, lpp.id);
    const currentStatus = deriveLppOperationalStatus({
      currentStatus: lpp.status,
      agreedTotal: lpp.agreedTotal,
      payments,
      expectedCompletionDate: lpp.expectedCompletionDate,
      convertedReceiptId: lpp.convertedReceiptId,
      convertedProjectId: lpp.convertedProjectId,
      fulfilledAt: lpp.fulfilledAt,
      now,
    });
    const financials = computeLppFinancialSummary({
      agreedTotal: lpp.agreedTotal,
      payments,
    });
    const dueDate = lpp.expectedCompletionDate;

    if (
      !dueDate ||
      financials.isFullyPaid ||
      ["CONVERTED_TO_POS", "CONVERTED_TO_PROJECT", "CLOSED"].includes(
        currentStatus,
      )
    ) {
      summary.results.push({
        lppId: lpp.id,
        reference: lpp.reference,
        skipped: true,
        reason: "not_eligible",
      });
      continue;
    }

    const createdTypes: string[] = [];
    const createdTasks: string[] = [];
    const notificationResults: Array<Record<string, unknown>> = [];
    const dispatchContext = await getLppReminderDispatchContext(db, lpp.id);

    for (const offset of dayOffsets) {
      const triggerDate = new Date(
        dueDate.getTime() - offset.days * 24 * 60 * 60 * 1000,
      );
      if (
        normalizeReminderDateKey(triggerDate) !== normalizeReminderDateKey(now)
      )
        continue;

      const payloadSnapshot: Record<string, Prisma.JsonValue> = {
        reference: lpp.reference,
        customerId: lpp.customerId,
        productId: lpp.productId ?? null,
        agreedTotal: financials.agreedTotal.toString(),
        totalPaid: financials.totalPaid.toString(),
        balance: financials.balance.toString(),
        percentagePaid: financials.percentagePaid.toString(),
        dueDate: dueDate.toISOString(),
        status: currentStatus,
      };

      if (!input?.dryRun) {
        const taskCreated = await ensureSystemLppFollowUpTask(db, {
          lipaPolePoleId: lpp.id,
          assignedToId: lpp.assignedToId,
          taskType: offset.taskType,
          taskDate: now,
          notes: `${offset.type.replace(/_/g, " ")} for ${lpp.reference}. Balance ${financials.balance.toString()}.`,
        });
        if (taskCreated) {
          summary.followUpsCreated += 1;
          createdTasks.push(offset.taskType);
        }

        createdTypes.push(offset.type);

        if (!dispatchContext?.expectedCompletionDate) {
          notificationResults.push({
            reminderType: offset.type,
            skipped: true,
            reason: "missing_dispatch_context",
          });
          continue;
        }

        const notificationContext = {
          reference: dispatchContext.reference,
          customerName: dispatchContext.customerName,
          customerPhone: dispatchContext.customerPhone,
          customerEmail: dispatchContext.customerEmail,
          productName: dispatchContext.productName,
          dueDate: dispatchContext.expectedCompletionDate,
          reminderType: offset.type,
          agreedTotal: Number(financials.agreedTotal ?? 0),
          totalPaid: Number(financials.totalPaid ?? 0),
          balance: Number(financials.balance ?? 0),
          currency: dispatchContext.currency || lpp.currency || "KES",
        } as const;

        for (const channel of ["SMS", "WHATSAPP", "EMAIL"] as const) {
          const reminder = await createLppReminderRecord(
            {
              lipaPolePoleId: lpp.id,
              reminderType: offset.type,
              dueDate,
              scheduledFor: now,
              channel,
              payloadSnapshot: {
                ...payloadSnapshot,
                channel,
                status: "PENDING",
              },
            },
            db,
          );
          if (!reminder.created) continue;

          summary.reminderRecordsCreated += 1;
          const dispatchResult = await sendLppReminderChannelNotification(
            notificationContext,
            channel,
          );
          const mergedPayload = {
            ...payloadSnapshot,
            channel,
            resultStatus: dispatchResult.status,
            error: dispatchResult.error,
            ...(dispatchResult.payloadSnapshot as Record<
              string,
              Prisma.JsonValue
            >),
          };

          await updateLppReminderDeliveryState(db, {
            idempotencyKey: reminder.idempotencyKey,
            status: dispatchResult.status,
            providerMessageId: dispatchResult.providerMessageId,
            payloadSnapshot: mergedPayload,
            sentAt: dispatchResult.status === "SENT" ? now : null,
          });

          if (dispatchResult.status === "SENT") summary.notificationsSent += 1;
          else if (dispatchResult.status === "FAILED")
            summary.notificationsFailed += 1;
          else summary.notificationsSkipped += 1;

          await writeLppEvent(db, {
            lipaPolePoleId: lpp.id,
            eventType:
              dispatchResult.status === "SENT"
                ? "REMINDER_SENT"
                : dispatchResult.status === "FAILED"
                  ? "REMINDER_FAILED"
                  : "REMINDER_SKIPPED",
            actorId: null,
            metadata: {
              reminderType: offset.type,
              channel,
              status: dispatchResult.status,
              providerMessageId: dispatchResult.providerMessageId,
              error: dispatchResult.error,
            },
          });

          notificationResults.push({
            reminderType: offset.type,
            channel,
            status: dispatchResult.status,
            providerMessageId: dispatchResult.providerMessageId,
            error: dispatchResult.error,
          });
        }
      } else {
        createdTypes.push(offset.type);
        createdTasks.push(offset.taskType);
        notificationResults.push(
          { reminderType: offset.type, channel: "SMS", status: "DRY_RUN" },
          { reminderType: offset.type, channel: "WHATSAPP", status: "DRY_RUN" },
          { reminderType: offset.type, channel: "EMAIL", status: "DRY_RUN" },
        );
      }
    }

    if (!input?.dryRun) {
      const promises = await getLppPromises(db, lpp.id);
      for (const promise of promises) {
        if (promise.status !== "ACTIVE") continue;
        if (
          normalizeReminderDateKey(promise.promiseDate) >
          normalizeReminderDateKey(now)
        )
          continue;
        await db.$executeRaw(Prisma.sql`
          UPDATE "LipaPolePolePromise"
          SET "status" = ${"BROKEN"}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${promise.id}
            AND "status" = ${"ACTIVE"}
        `);
        summary.promisesBroken += 1;
        const taskCreated = await ensureSystemLppFollowUpTask(db, {
          lipaPolePoleId: lpp.id,
          assignedToId: lpp.assignedToId,
          taskType: "BROKEN_PROMISE",
          taskDate: now,
          notes: `Promise of ${promise.promiseAmount.toString()} due ${promise.promiseDate.toISOString().slice(0, 10)} is broken.`,
        });
        if (taskCreated) summary.followUpsCreated += 1;
        await writeLppEvent(db, {
          lipaPolePoleId: lpp.id,
          eventType: "PROMISE_BROKEN",
          actorId: null,
          metadata: {
            promiseId: promise.id,
            promiseAmount: promise.promiseAmount.toString(),
            promiseDate: promise.promiseDate.toISOString(),
          },
        });
      }
    }

    summary.results.push({
      lppId: lpp.id,
      reference: lpp.reference,
      reminderTypes: createdTypes,
      followUpTasks: createdTasks,
      notifications: notificationResults,
      dryRun: Boolean(input?.dryRun),
    });
  }

  return summary;
}
