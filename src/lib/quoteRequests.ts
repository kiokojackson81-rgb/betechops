import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    "propertyType" TEXT,
    "loadDescription" TEXT,
    "budgetRange" TEXT,
    "preferredProducts" TEXT,
    "notes" TEXT,
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

export const quoteRequestCreateSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().min(7),
  email: z.string().trim().email().optional().or(z.literal("")),
  location: z.string().trim().optional(),
  county: z.string().trim().optional(),
  town: z.string().trim().optional(),
  specificLocation: z.string().trim().optional(),
  propertyType: z.string().trim().optional(),
  load: z.string().trim().optional(),
  budgetRange: z.string().trim().optional(),
  preferredProducts: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type QuoteRequestCreateInput = z.infer<typeof quoteRequestCreateSchema> & {
  customerUserId?: string | null;
};

export const quoteRequestResponseSchema = z.object({
  status: z.enum(QUOTE_REQUEST_STATUSES),
  quoteTitle: z.string().trim().max(200).optional(),
  quoteMessage: z.string().trim().max(12000).optional(),
  batterySize: z.string().trim().max(200).optional(),
  inverterSize: z.string().trim().max(200).optional(),
  panelSetup: z.string().trim().max(500).optional(),
  accessories: z.string().trim().max(1200).optional(),
  estimatedAmount: z.string().trim().max(120).optional(),
  recommendedProducts: z.string().trim().max(4000).optional(),
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
  propertyType: string | null;
  loadDescription: string | null;
  budgetRange: string | null;
  preferredProducts: string | null;
  notes: string | null;
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
  propertyType: string | null;
  loadDescription: string | null;
  budgetRange: string | null;
  preferredProducts: string | null;
  notes: string | null;
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
    propertyType: row.propertyType,
    loadDescription: row.loadDescription,
    budgetRange: row.budgetRange,
    preferredProducts: row.preferredProducts,
    notes: row.notes,
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
      "propertyType",
      "loadDescription",
      "budgetRange",
      "preferredProducts",
      "notes",
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
      ${input.propertyType?.trim() || null},
      ${input.load?.trim() || null},
      ${input.budgetRange?.trim() || null},
      ${input.preferredProducts?.trim() || null},
      ${input.notes?.trim() || null},
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
  const quotationData = {
    batterySize: input.batterySize?.trim() || null,
    inverterSize: input.inverterSize?.trim() || null,
    panelSetup: input.panelSetup?.trim() || null,
    accessories: input.accessories?.trim() || null,
    estimatedAmount: input.estimatedAmount?.trim() || null,
    recommendedProducts: input.recommendedProducts?.trim() || null,
  } satisfies Record<string, string | null>;

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
