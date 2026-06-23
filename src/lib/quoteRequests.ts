import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  quoteLineItemSchema,
  quotePaymentMethodSchema,
  quotePaymentTermsSchema,
  sanitizeQuoteLineItems,
  calculateQuoteTotal,
  normalizeQuotePaymentBreakdown,
} from "@/lib/quoteProposal";

const QUOTE_REQUEST_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS "QuoteRequest" (
    "id" TEXT NOT NULL,
    "quoteRef" TEXT NOT NULL,
    "customerUserId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerLocation" TEXT,
    "county" TEXT,
    "town" TEXT,
    "specificLocation" TEXT,
    "projectType" TEXT,
    "propertyType" TEXT,
    "preferredContactMethod" TEXT,
    "bestTimeToContact" TEXT,
    "urgency" TEXT,
    "installationStatus" TEXT,
    "loadDescription" TEXT,
    "budgetRange" TEXT,
    "preferredProducts" TEXT,
    "notes" TEXT,
    "answersJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assignedAttendantId" TEXT,
    "assignedAttendantEmail" TEXT,
    "assignedAttendantName" TEXT,
    "quoteTitle" TEXT,
    "quoteMessage" TEXT,
    "quotationData" JSONB,
    "responseMetadata" JSONB,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "QuoteRequest_quoteRef_key" ON "QuoteRequest"("quoteRef")`,
  `CREATE INDEX IF NOT EXISTS "QuoteRequest_status_createdAt_idx" ON "QuoteRequest"("status","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "QuoteRequest_assignedAttendantId_createdAt_idx" ON "QuoteRequest"("assignedAttendantId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "QuoteRequest_customerUserId_createdAt_idx" ON "QuoteRequest"("customerUserId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "QuoteRequest_customerPhone_createdAt_idx" ON "QuoteRequest"("customerPhone","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "QuoteRequest_customerEmail_createdAt_idx" ON "QuoteRequest"("customerEmail","createdAt")`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "projectType" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "preferredContactMethod" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "bestTimeToContact" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "urgency" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "installationStatus" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "answersJson" JSONB`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuoteRequest_customerUserId_fkey'
        AND table_name = 'QuoteRequest'
    ) THEN
      ALTER TABLE "QuoteRequest"
        ADD CONSTRAINT "QuoteRequest_customerUserId_fkey"
        FOREIGN KEY ("customerUserId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuoteRequest_respondedById_fkey'
        AND table_name = 'QuoteRequest'
    ) THEN
      ALTER TABLE "QuoteRequest"
        ADD CONSTRAINT "QuoteRequest_respondedById_fkey"
        FOREIGN KEY ("respondedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,
] as const;

const QUOTE_REQUEST_STAFF_EMAILS = ["jeniffer@betech.co.ke", "brendah@betech.co.ke"] as const;

const globalQuoteRequestState = globalThis as typeof globalThis & {
  __quoteRequestSchemaReady?: Promise<void>;
};

export const QUOTE_REQUEST_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUOTED",
  "FOLLOW_UP",
  "CONVERTED",
  "CLOSED",
] as const;

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

export const QUOTE_PROJECT_TYPES = [
  "SOLAR_HOME_SYSTEM",
  "SOLAR_WATER_PUMP",
  "SOLAR_WATER_HEATER",
  "BOREHOLE_SOLAR_SYSTEM",
  "COMMERCIAL_SOLAR_SYSTEM",
  "CCTV_PLUS_SOLAR",
  "STREET_LIGHTS",
  "OTHER",
] as const;

export type QuoteProjectType = (typeof QUOTE_PROJECT_TYPES)[number];

export const QUOTE_CONTACT_METHODS = ["PHONE_CALL", "WHATSAPP", "EMAIL"] as const;
export type QuoteContactMethod = (typeof QUOTE_CONTACT_METHODS)[number];

export const QUOTE_CONTACT_TIMES = ["ANYTIME", "MORNING", "AFTERNOON", "EVENING"] as const;
export type QuoteContactTime = (typeof QUOTE_CONTACT_TIMES)[number];

export const QUOTE_URGENCY_LEVELS = [
  "TODAY",
  "THIS_WEEK",
  "THIS_MONTH",
  "JUST_RESEARCHING",
] as const;
export type QuoteUrgency = (typeof QUOTE_URGENCY_LEVELS)[number];

export const QUOTE_INSTALLATION_STATUSES = [
  "NEW_INSTALLATION",
  "UPGRADE_EXISTING_SYSTEM",
  "REPAIR_OR_REPLACEMENT",
] as const;
export type QuoteInstallationStatus = (typeof QUOTE_INSTALLATION_STATUSES)[number];

const quoteStructuredAnswersSchema = z
  .object({
    solarHome: z
      .object({
        appliances: z.array(z.string().trim()).optional(),
        quantities: z.record(z.string(), z.string()).optional(),
        backupDuration: z.string().trim().optional(),
        powerUsePattern: z.string().trim().optional(),
        existingPowerSource: z.string().trim().optional(),
      })
      .optional(),
    solarWaterPump: z
      .object({
        waterSource: z.string().trim().optional(),
        boreholeDepth: z.string().trim().optional(),
        waterLevel: z.string().trim().optional(),
        tankSize: z.string().trim().optional(),
        tankHeight: z.string().trim().optional(),
        distanceToTank: z.string().trim().optional(),
        dailyWaterRequirement: z.string().trim().optional(),
      })
      .optional(),
    solarWaterHeater: z
      .object({
        numberOfUsers: z.string().trim().optional(),
        usageType: z.string().trim().optional(),
        existingTankSize: z.string().trim().optional(),
        dailyHotWaterUsage: z.string().trim().optional(),
      })
      .optional(),
    commercialSolar: z
      .object({
        businessType: z.string().trim().optional(),
        keyEquipment: z.string().trim().optional(),
        estimatedMonthlyBill: z.string().trim().optional(),
        phaseType: z.string().trim().optional(),
        usagePattern: z.string().trim().optional(),
      })
      .optional(),
    cctvSolar: z
      .object({
        cameraCount: z.string().trim().optional(),
        recorderType: z.string().trim().optional(),
        routerRequired: z.string().trim().optional(),
        backupDuration: z.string().trim().optional(),
      })
      .optional(),
    streetLights: z
      .object({
        poleCount: z.string().trim().optional(),
        poleHeight: z.string().trim().optional(),
        coverageArea: z.string().trim().optional(),
        brightnessNeed: z.string().trim().optional(),
      })
      .optional(),
    general: z.record(z.string(), z.string()).optional(),
  })
  .optional();

export const quoteRequestCreateSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().min(7),
  email: z.string().trim().email().optional().or(z.literal("")),
  location: z.string().trim().optional(),
  county: z.string().trim().optional(),
  town: z.string().trim().optional(),
  specificLocation: z.string().trim().optional(),
  projectType: z.enum(QUOTE_PROJECT_TYPES),
  propertyType: z.string().trim().optional(),
  preferredContactMethod: z.enum(QUOTE_CONTACT_METHODS).optional(),
  bestTimeToContact: z.enum(QUOTE_CONTACT_TIMES).optional(),
  urgency: z.enum(QUOTE_URGENCY_LEVELS).optional(),
  installationStatus: z.enum(QUOTE_INSTALLATION_STATUSES).optional(),
  load: z.string().trim().optional(),
  budgetRange: z.string().trim().optional(),
  preferredProducts: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  answers: quoteStructuredAnswersSchema,
});

export type QuoteRequestCreateInput = z.infer<typeof quoteRequestCreateSchema> & {
  customerUserId?: string | null;
};

export const quoteRequestResponseSchema = z.object({
  status: z.enum(QUOTE_REQUEST_STATUSES),
  quoteTitle: z.string().trim().max(200).optional(),
  quoteMessage: z.string().trim().max(12000).optional(),
  quoteItems: z.array(quoteLineItemSchema).default([]),
  paymentMethod: quotePaymentMethodSchema.optional(),
  paymentTerms: quotePaymentTermsSchema.optional(),
  depositAmount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z.number().nonnegative().max(1000000000).optional(),
  ),
  balanceAmount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z.number().nonnegative().max(1000000000).optional(),
  ),
  followUpNotes: z.string().trim().max(4000).optional(),
  sendEmail: z.boolean().optional(),
  sendSms: z.boolean().optional(),
});

export type QuoteRequestResponseInput = z.infer<typeof quoteRequestResponseSchema>;

type QuoteRequestRow = {
  id: string;
  quoteRef: string;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerLocation: string | null;
  county: string | null;
  town: string | null;
  specificLocation: string | null;
  projectType: string | null;
  propertyType: string | null;
  preferredContactMethod: string | null;
  bestTimeToContact: string | null;
  urgency: string | null;
  installationStatus: string | null;
  loadDescription: string | null;
  budgetRange: string | null;
  preferredProducts: string | null;
  notes: string | null;
  answersJson: Prisma.JsonValue | null;
  status: string;
  assignedAttendantId: string | null;
  assignedAttendantEmail: string | null;
  assignedAttendantName: string | null;
  quoteTitle: string | null;
  quoteMessage: string | null;
  quotationData: Prisma.JsonValue | null;
  responseMetadata: Prisma.JsonValue | null;
  respondedAt: Date | string | null;
  respondedById: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type SerializedQuoteRequest = {
  id: string;
  quoteRef: string;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerLocation: string | null;
  county: string | null;
  town: string | null;
  specificLocation: string | null;
  projectType: QuoteProjectType | null;
  propertyType: string | null;
  preferredContactMethod: QuoteContactMethod | null;
  bestTimeToContact: QuoteContactTime | null;
  urgency: QuoteUrgency | null;
  installationStatus: QuoteInstallationStatus | null;
  loadDescription: string | null;
  budgetRange: string | null;
  preferredProducts: string | null;
  notes: string | null;
  answers: Record<string, unknown> | null;
  status: QuoteRequestStatus;
  assignedAttendant: {
    id: string | null;
    email: string | null;
    name: string | null;
  } | null;
  quoteTitle: string | null;
  quoteMessage: string | null;
  quotationData: Record<string, unknown> | null;
  responseMetadata: Record<string, unknown> | null;
  respondedAt: string | null;
  respondedById: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePhone(value: unknown) {
  return String(value ?? "").trim();
}

function isQuoteStatus(value: unknown): value is QuoteRequestStatus {
  return QUOTE_REQUEST_STATUSES.includes(String(value).trim().toUpperCase() as QuoteRequestStatus);
}

function isQuoteProjectType(value: unknown): value is QuoteProjectType {
  return QUOTE_PROJECT_TYPES.includes(String(value).trim().toUpperCase() as QuoteProjectType);
}

function isQuoteContactMethod(value: unknown): value is QuoteContactMethod {
  return QUOTE_CONTACT_METHODS.includes(String(value).trim().toUpperCase() as QuoteContactMethod);
}

function isQuoteContactTime(value: unknown): value is QuoteContactTime {
  return QUOTE_CONTACT_TIMES.includes(String(value).trim().toUpperCase() as QuoteContactTime);
}

function isQuoteUrgency(value: unknown): value is QuoteUrgency {
  return QUOTE_URGENCY_LEVELS.includes(String(value).trim().toUpperCase() as QuoteUrgency);
}

function isQuoteInstallationStatus(value: unknown): value is QuoteInstallationStatus {
  return QUOTE_INSTALLATION_STATUSES.includes(
    String(value).trim().toUpperCase() as QuoteInstallationStatus,
  );
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asJsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildQuoteRequestRef() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BT-QUOTE-${stamp}-${random}`;
}

async function buildUniqueQuoteRequestRef() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const quoteRef = buildQuoteRequestRef();
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "QuoteRequest"
      WHERE "quoteRef" = ${quoteRef}
      LIMIT 1
    `);
    if (!rows.length) return quoteRef;
  }

  return `BT-QUOTE-${Date.now()}`;
}

export async function ensureQuoteRequestsSchema() {
  if (!globalQuoteRequestState.__quoteRequestSchemaReady) {
    globalQuoteRequestState.__quoteRequestSchemaReady = (async () => {
      for (const statement of QUOTE_REQUEST_SCHEMA_SQL) {
        await prisma.$executeRawUnsafe(statement);
      }
    })().catch((error) => {
      globalQuoteRequestState.__quoteRequestSchemaReady = undefined;
      throw error;
    });
  }

  await globalQuoteRequestState.__quoteRequestSchemaReady;
}

export function isQuoteRequestsStaffEmail(email: unknown) {
  return QUOTE_REQUEST_STAFF_EMAILS.includes(
    normalizeEmail(email) as (typeof QUOTE_REQUEST_STAFF_EMAILS)[number],
  );
}

export async function requireQuoteRequestsStaffActor(options?: { impersonateId?: string | null }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const email = normalizeEmail((session?.user as { email?: string } | undefined)?.email);

  if (!session || !userId) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const hasElevatedRole = role === "ADMIN" || role === "SUPERVISOR";
  if (hasElevatedRole && options?.impersonateId) {
    const targetUser = await prisma.user.findUnique({
      where: { id: options.impersonateId },
      select: { id: true, name: true, email: true },
    });
    if (!targetUser || !isQuoteRequestsStaffEmail(targetUser.email)) {
      return { ok: false as const, status: 403, error: "Invalid quotation attendant target." };
    }
    return {
      ok: true as const,
      session,
      role,
      actorUserId: userId,
      userId: targetUser.id,
      email: normalizeEmail(targetUser.email),
      name: targetUser.name ?? targetUser.email ?? "Quotation attendant",
      isElevatedActor: true,
    };
  }

  if (!hasElevatedRole && !isQuoteRequestsStaffEmail(email)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return {
    ok: true as const,
    session,
    role,
    actorUserId: userId,
    userId,
    email,
    name:
      (session.user as { name?: string } | undefined)?.name ??
      (session.user as { email?: string } | undefined)?.email ??
      "Quotation attendant",
    isElevatedActor: hasElevatedRole,
  };
}

async function getOrderedQuoteStaffUsers() {
  const staffUsers = await prisma.user.findMany({
    where: { email: { in: [...QUOTE_REQUEST_STAFF_EMAILS] } },
    select: { id: true, name: true, email: true },
  });

  return QUOTE_REQUEST_STAFF_EMAILS.map((email) =>
    staffUsers.find((user) => normalizeEmail(user.email) === email),
  ).filter(
    (user): user is { id: string; name: string | null; email: string | null } => Boolean(user?.id),
  );
}

async function pickQuoteAssignee() {
  const orderedStaff = await getOrderedQuoteStaffUsers();
  if (!orderedStaff.length) return null;

  const counts = new Map<string, number>(orderedStaff.map((user) => [user.id, 0]));
  const rows = await prisma.$queryRaw<
    Array<{ assignedAttendantId: string | null; total: bigint | number }>
  >(Prisma.sql`
    SELECT "assignedAttendantId", COUNT(*)::bigint AS "total"
    FROM "QuoteRequest"
    WHERE "assignedAttendantId" IS NOT NULL
    GROUP BY "assignedAttendantId"
  `);

  for (const row of rows) {
    const staffId = row.assignedAttendantId ? String(row.assignedAttendantId) : null;
    if (!staffId || !counts.has(staffId)) continue;
    counts.set(staffId, Number(row.total ?? 0));
  }

  return orderedStaff.reduce((best, current) => {
    if (!best) return current;
    const bestCount = Number(counts.get(best.id) ?? 0);
    const currentCount = Number(counts.get(current.id) ?? 0);
    return currentCount < bestCount ? current : best;
  }, orderedStaff[0] ?? null);
}

export async function ensureQuoteRequestAssignments() {
  await ensureQuoteRequestsSchema();
  const orderedStaff = await getOrderedQuoteStaffUsers();
  if (!orderedStaff.length) return orderedStaff;

  const unassignedRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "QuoteRequest"
    WHERE "assignedAttendantId" IS NULL
    ORDER BY "createdAt" ASC
  `);

  if (!unassignedRows.length) return orderedStaff;

  let roundRobinIndex = 0;
  for (const row of unassignedRows) {
    const assignee = orderedStaff[roundRobinIndex % orderedStaff.length];
    roundRobinIndex += 1;
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "QuoteRequest"
      SET
        "assignedAttendantId" = ${assignee.id},
        "assignedAttendantEmail" = ${normalizeEmail(assignee.email)},
        "assignedAttendantName" = ${assignee.name ?? assignee.email ?? "Quotation attendant"},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${row.id}
    `);
  }

  return orderedStaff;
}

export function serializeQuoteRequest(row: QuoteRequestRow): SerializedQuoteRequest {
  return {
    id: row.id,
    quoteRef: row.quoteRef,
    customerUserId: row.customerUserId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    customerLocation: row.customerLocation,
    county: row.county,
    town: row.town,
    specificLocation: row.specificLocation,
    projectType: isQuoteProjectType(row.projectType) ? row.projectType : null,
    propertyType: row.propertyType,
    preferredContactMethod: isQuoteContactMethod(row.preferredContactMethod)
      ? row.preferredContactMethod
      : null,
    bestTimeToContact: isQuoteContactTime(row.bestTimeToContact) ? row.bestTimeToContact : null,
    urgency: isQuoteUrgency(row.urgency) ? row.urgency : null,
    installationStatus: isQuoteInstallationStatus(row.installationStatus)
      ? row.installationStatus
      : null,
    loadDescription: row.loadDescription,
    budgetRange: row.budgetRange,
    preferredProducts: row.preferredProducts,
    notes: row.notes,
    answers: asJsonObject(row.answersJson),
    status: isQuoteStatus(row.status) ? row.status : "NEW",
    assignedAttendant: row.assignedAttendantId
      ? {
          id: row.assignedAttendantId,
          email: row.assignedAttendantEmail,
          name: row.assignedAttendantName,
        }
      : null,
    quoteTitle: row.quoteTitle,
    quoteMessage: row.quoteMessage,
    quotationData: asJsonObject(row.quotationData),
    responseMetadata: asJsonObject(row.responseMetadata),
    respondedAt: toIsoString(row.respondedAt),
    respondedById: row.respondedById,
    metadata: asJsonObject(row.metadata),
    createdAt: toIsoString(row.createdAt) || new Date().toISOString(),
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

export async function createQuoteRequest(input: QuoteRequestCreateInput) {
  await ensureQuoteRequestsSchema();
  const quoteRef = await buildUniqueQuoteRequestRef();
  const assignee = await pickQuoteAssignee();
  const id = randomUUID();

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "QuoteRequest" (
      "id",
      "quoteRef",
      "customerUserId",
      "customerName",
      "customerPhone",
      "customerEmail",
      "customerLocation",
      "county",
      "town",
      "specificLocation",
      "projectType",
      "propertyType",
      "preferredContactMethod",
      "bestTimeToContact",
      "urgency",
      "installationStatus",
      "loadDescription",
      "budgetRange",
      "preferredProducts",
      "notes",
      "answersJson",
      "status",
      "assignedAttendantId",
      "assignedAttendantEmail",
      "assignedAttendantName",
      "metadata",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${id},
      ${quoteRef},
      ${input.customerUserId ?? null},
      ${input.name.trim()},
      ${normalizePhone(input.phone)},
      ${input.email?.trim() || null},
      ${input.location?.trim() || null},
      ${input.county?.trim() || null},
      ${input.town?.trim() || null},
      ${input.specificLocation?.trim() || null},
      ${input.projectType},
      ${input.propertyType?.trim() || null},
      ${input.preferredContactMethod || null},
      ${input.bestTimeToContact || null},
      ${input.urgency || null},
      ${input.installationStatus || null},
      ${input.load?.trim() || null},
      ${input.budgetRange?.trim() || null},
      ${input.preferredProducts?.trim() || null},
      ${input.notes?.trim() || null},
      ${(input.answers || null) as Prisma.JsonObject | null},
      ${"NEW"},
      ${assignee?.id ?? null},
      ${assignee?.email ? normalizeEmail(assignee.email) : null},
      ${assignee?.name ?? assignee?.email ?? null},
      ${{
        source: "SHOP_QUOTE",
        assignedAt: new Date().toISOString(),
      } as Prisma.JsonObject},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);

  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT *
    FROM "QuoteRequest"
    WHERE "id" = ${id}
    LIMIT 1
  `);

  return rows[0] ? serializeQuoteRequest(rows[0]) : null;
}

function buildStatusWhere(status: QuoteRequestStatus | "ALL") {
  if (status === "ALL") return Prisma.empty;
  return Prisma.sql`AND "status" = ${status}`;
}

export async function listAssignedQuoteRequests(input: {
  userId: string;
  status?: QuoteRequestStatus | "ALL";
  q?: string;
}) {
  await ensureQuoteRequestsSchema();
  const query = (input.q || "").trim();
  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT *
    FROM "QuoteRequest"
    WHERE "assignedAttendantId" = ${input.userId}
      ${buildStatusWhere(input.status || "ALL")}
      ${
        query
          ? Prisma.sql`AND (
              "quoteRef" ILIKE ${`%${query}%`}
              OR "customerName" ILIKE ${`%${query}%`}
              OR "customerPhone" ILIKE ${`%${query}%`}
              OR COALESCE("customerEmail", '') ILIKE ${`%${query}%`}
              OR COALESCE("customerLocation", '') ILIKE ${`%${query}%`}
              OR COALESCE("preferredProducts", '') ILIKE ${`%${query}%`}
            )`
          : Prisma.empty
      }
    ORDER BY
      CASE
        WHEN "status" = 'NEW' THEN 1
        WHEN "status" = 'CONTACTED' THEN 2
        WHEN "status" = 'FOLLOW_UP' THEN 3
        WHEN "status" = 'QUOTED' THEN 4
        WHEN "status" = 'CONVERTED' THEN 5
        ELSE 6
      END ASC,
      "createdAt" DESC
  `);

  return rows.map(serializeQuoteRequest);
}

export async function getAssignedQuoteRequestById(id: string, userId: string) {
  await ensureQuoteRequestsSchema();
  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT *
    FROM "QuoteRequest"
    WHERE "id" = ${id}
      AND "assignedAttendantId" = ${userId}
    LIMIT 1
  `);
  return rows[0] ? serializeQuoteRequest(rows[0]) : null;
}

export async function updateQuoteRequestResponse(
  id: string,
  user: { id: string; name: string | null; email: string | null },
  input: QuoteRequestResponseInput,
) {
  await ensureQuoteRequestsSchema();
  const sanitizedItems = sanitizeQuoteLineItems(input.quoteItems);
  const subtotal = calculateQuoteTotal(sanitizedItems);
  const paymentBreakdown = normalizeQuotePaymentBreakdown({
    total: subtotal,
    paymentTerms: input.paymentTerms,
    depositAmount: input.depositAmount,
    balanceAmount: input.balanceAmount,
  });
  const quotationData = {
    items: sanitizedItems,
    subtotal,
    total: paymentBreakdown.total,
    paymentMethod: input.paymentMethod || null,
    paymentTerms: paymentBreakdown.paymentTerms,
    depositAmount: paymentBreakdown.depositAmount,
    balanceAmount: paymentBreakdown.balanceAmount,
  } satisfies Record<string, Prisma.JsonValue>;

  const responseMetadata = {
    followUpNotes: input.followUpNotes?.trim() || null,
    sendEmail: Boolean(input.sendEmail),
    sendSms: Boolean(input.sendSms),
    lastRespondedByEmail: normalizeEmail(user.email),
    lastRespondedByName: user.name ?? user.email ?? "Quotation attendant",
    lastRespondedAt: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "QuoteRequest"
    SET
      "status" = ${input.status},
      "quoteTitle" = ${input.quoteTitle?.trim() || null},
      "quoteMessage" = ${input.quoteMessage?.trim() || null},
      "quotationData" = ${quotationData as Prisma.JsonObject},
      "responseMetadata" = ${responseMetadata as Prisma.JsonObject},
      "respondedAt" = CURRENT_TIMESTAMP,
      "respondedById" = ${user.id},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
  `);

  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT *
    FROM "QuoteRequest"
    WHERE "id" = ${id}
    LIMIT 1
  `);

  return rows[0] ? serializeQuoteRequest(rows[0]) : null;
}

export async function backfillQuoteRequestsForCustomerAccount(input: {
  userId: string;
  phoneVariants: string[];
  normalizedEmails: string[];
}) {
  await ensureQuoteRequestsSchema();
  const phoneVariants = [...new Set(input.phoneVariants.map(normalizePhone).filter(Boolean))];
  const normalizedEmails = [...new Set(input.normalizedEmails.map(normalizeEmail).filter(Boolean))];

  if (!phoneVariants.length && !normalizedEmails.length) return;

  const conditions: Prisma.Sql[] = [];
  if (phoneVariants.length) {
    conditions.push(Prisma.sql`"customerPhone" IN (${Prisma.join(phoneVariants)})`);
  }
  if (normalizedEmails.length) {
    conditions.push(
      Prisma.sql`LOWER(COALESCE("customerEmail", '')) IN (${Prisma.join(normalizedEmails)})`,
    );
  }
  if (!conditions.length) return;

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "QuoteRequest"
    SET
      "customerUserId" = ${input.userId},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE (${Prisma.join(conditions, " OR ")})
      AND COALESCE("customerUserId", '') <> ${input.userId}
  `);
}

export async function listCustomerQuoteRequests(input: {
  userId: string;
  phoneVariants: string[];
  normalizedEmails: string[];
  take?: number;
}) {
  await ensureQuoteRequestsSchema();
  const conditions: Prisma.Sql[] = [Prisma.sql`"customerUserId" = ${input.userId}`];
  const phoneVariants = [...new Set(input.phoneVariants.map(normalizePhone).filter(Boolean))];
  const normalizedEmails = [...new Set(input.normalizedEmails.map(normalizeEmail).filter(Boolean))];

  if (phoneVariants.length) {
    conditions.push(Prisma.sql`"customerPhone" IN (${Prisma.join(phoneVariants)})`);
  }
  if (normalizedEmails.length) {
    conditions.push(
      Prisma.sql`LOWER(COALESCE("customerEmail", '')) IN (${Prisma.join(normalizedEmails)})`,
    );
  }

  const take = Math.max(1, Math.min(20, Number(input.take ?? 5)));

  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT *
    FROM "QuoteRequest"
    WHERE (${Prisma.join(conditions, " OR ")})
    ORDER BY "createdAt" DESC
    LIMIT ${take}
  `);

  return rows.map(serializeQuoteRequest);
}
