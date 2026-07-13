import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  QUOTE_PROJECT_TYPES,
  type QuoteProjectType,
  getQuoteRequestByRef,
  recordQuotationEvent,
} from "@/lib/quoteRequests";
import {
  SITE_VISIT_OUTCOMES,
  SITE_VISIT_PAYMENT_STATUSES,
  SITE_VISIT_REASONS,
  SITE_VISIT_STATUSES,
  type SerializedSiteVisit,
  type SerializedSiteVisitAttachment,
  type SerializedSiteVisitEvent,
  type SiteVisitOutcome,
  type SiteVisitPaymentStatus,
  type SiteVisitReason,
  type SiteVisitStatus,
} from "@/lib/siteVisitShared";

export {
  SITE_VISIT_OUTCOMES,
  SITE_VISIT_PAYMENT_STATUSES,
  SITE_VISIT_REASONS,
  SITE_VISIT_STATUSES,
};
export type {
  SerializedSiteVisit,
  SerializedSiteVisitAttachment,
  SerializedSiteVisitEvent,
  SiteVisitOutcome,
  SiteVisitPaymentStatus,
  SiteVisitReason,
  SiteVisitStatus,
};

const globalSiteVisitState = globalThis as typeof globalThis & {
  __siteVisitSchemaReady?: Promise<void>;
};

const SITE_VISIT_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS "SiteVisit" (
    "id" TEXT NOT NULL,
    "visitRef" TEXT NOT NULL,
    "quoteRequestId" TEXT,
    "quoteRef" TEXT,
    "customerUserId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "companyName" TEXT,
    "siteContactPerson" TEXT,
    "alternativePhone" TEXT,
    "county" TEXT,
    "town" TEXT,
    "location" TEXT,
    "mapUrl" TEXT,
    "landmark" TEXT,
    "propertyType" TEXT,
    "accessInstructions" TEXT,
    "projectType" TEXT,
    "visitReason" TEXT,
    "preferredDate" TIMESTAMP(3),
    "preferredTimeLabel" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "estimatedDurationMinutes" INTEGER,
    "assignedStaffId" TEXT,
    "assignedStaffName" TEXT,
    "assignedTechnicianId" TEXT,
    "assignedTechnicianName" TEXT,
    "transportMethod" TEXT,
    "visitFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paymentReference" TEXT,
    "customerRequirements" TEXT,
    "appliancesToInspect" TEXT,
    "specialInstructions" TEXT,
    "internalNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "findings" TEXT,
    "assessmentSummary" TEXT,
    "recommendedSystem" TEXT,
    "recommendedItems" TEXT,
    "risks" TEXT,
    "nextAction" TEXT,
    "outcome" TEXT,
    "closedReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SiteVisit_visitRef_key" ON "SiteVisit"("visitRef")`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_status_scheduledAt_idx" ON "SiteVisit"("status","scheduledAt")`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_customerUserId_createdAt_idx" ON "SiteVisit"("customerUserId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_customerPhone_createdAt_idx" ON "SiteVisit"("customerPhone","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_quoteRequestId_createdAt_idx" ON "SiteVisit"("quoteRequestId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_assignedStaffId_scheduledAt_idx" ON "SiteVisit"("assignedStaffId","scheduledAt")`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_assignedTechnicianId_scheduledAt_idx" ON "SiteVisit"("assignedTechnicianId","scheduledAt")`,
  `CREATE TABLE IF NOT EXISTS "SiteVisitEvent" (
    "id" TEXT NOT NULL,
    "siteVisitId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventLabel" TEXT NOT NULL,
    "eventDetail" TEXT,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteVisitEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "SiteVisitEvent_siteVisitId_createdAt_idx" ON "SiteVisitEvent"("siteVisitId","createdAt")`,
  `CREATE TABLE IF NOT EXISTS "SiteVisitAttachment" (
    "id" TEXT NOT NULL,
    "siteVisitId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT,
    "contentType" TEXT,
    "fileSizeBytes" INTEGER,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteVisitAttachment_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "SiteVisitAttachment_siteVisitId_createdAt_idx" ON "SiteVisitAttachment"("siteVisitId","createdAt")`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'SiteVisit_quoteRequestId_fkey'
        AND table_name = 'SiteVisit'
    ) THEN
      ALTER TABLE "SiteVisit"
        ADD CONSTRAINT "SiteVisit_quoteRequestId_fkey"
        FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'SiteVisit_customerUserId_fkey'
        AND table_name = 'SiteVisit'
    ) THEN
      ALTER TABLE "SiteVisit"
        ADD CONSTRAINT "SiteVisit_customerUserId_fkey"
        FOREIGN KEY ("customerUserId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'SiteVisit_assignedStaffId_fkey'
        AND table_name = 'SiteVisit'
    ) THEN
      ALTER TABLE "SiteVisit"
        ADD CONSTRAINT "SiteVisit_assignedStaffId_fkey"
        FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'SiteVisit_assignedTechnicianId_fkey'
        AND table_name = 'SiteVisit'
    ) THEN
      ALTER TABLE "SiteVisit"
        ADD CONSTRAINT "SiteVisit_assignedTechnicianId_fkey"
        FOREIGN KEY ("assignedTechnicianId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'SiteVisit_createdById_fkey'
        AND table_name = 'SiteVisit'
    ) THEN
      ALTER TABLE "SiteVisit"
        ADD CONSTRAINT "SiteVisit_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'SiteVisitEvent_siteVisitId_fkey'
        AND table_name = 'SiteVisitEvent'
    ) THEN
      ALTER TABLE "SiteVisitEvent"
        ADD CONSTRAINT "SiteVisitEvent_siteVisitId_fkey"
        FOREIGN KEY ("siteVisitId") REFERENCES "SiteVisit"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'SiteVisitAttachment_siteVisitId_fkey'
        AND table_name = 'SiteVisitAttachment'
    ) THEN
      ALTER TABLE "SiteVisitAttachment"
        ADD CONSTRAINT "SiteVisitAttachment_siteVisitId_fkey"
        FOREIGN KEY ("siteVisitId") REFERENCES "SiteVisit"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
] as const;

type SiteVisitRow = {
  id: string;
  visitRef: string;
  quoteRequestId: string | null;
  quoteRef: string | null;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  companyName: string | null;
  siteContactPerson: string | null;
  alternativePhone: string | null;
  county: string | null;
  town: string | null;
  location: string | null;
  mapUrl: string | null;
  landmark: string | null;
  propertyType: string | null;
  accessInstructions: string | null;
  projectType: string | null;
  visitReason: string | null;
  preferredDate: Date | string | null;
  preferredTimeLabel: string | null;
  scheduledAt: Date | string | null;
  estimatedDurationMinutes: number | null;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  transportMethod: string | null;
  visitFee: number | null;
  paymentStatus: string | null;
  paymentReference: string | null;
  customerRequirements: string | null;
  appliancesToInspect: string | null;
  specialInstructions: string | null;
  internalNotes: string | null;
  status: string;
  findings: string | null;
  assessmentSummary: string | null;
  recommendedSystem: string | null;
  recommendedItems: string | null;
  risks: string | null;
  nextAction: string | null;
  outcome: string | null;
  closedReason: string | null;
  completedAt: Date | string | null;
  closedAt: Date | string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type SiteVisitEventRow = {
  id: string;
  siteVisitId: string;
  eventType: string;
  eventLabel: string;
  eventDetail: string | null;
  actorUserId: string | null;
  actorName: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date | string;
};

type SiteVisitAttachmentRow = {
  id: string;
  siteVisitId: string;
  fileName: string;
  fileUrl: string;
  fileKey: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  uploadedById: string | null;
  uploadedByName: string | null;
  createdAt: Date | string;
};

const SITE_VISIT_SELECT_SQL = Prisma.sql`
  "id",
  "visitRef",
  "quoteRequestId",
  "quoteRef",
  "customerUserId",
  "customerName",
  "customerPhone",
  "customerEmail",
  "companyName",
  "siteContactPerson",
  "alternativePhone",
  "county",
  "town",
  "location",
  "mapUrl",
  "landmark",
  "propertyType",
  "accessInstructions",
  "projectType",
  "visitReason",
  "preferredDate",
  "preferredTimeLabel",
  "scheduledAt",
  "estimatedDurationMinutes",
  "assignedStaffId",
  "assignedStaffName",
  "assignedTechnicianId",
  "assignedTechnicianName",
  "transportMethod",
  "visitFee",
  "paymentStatus",
  "paymentReference",
  "customerRequirements",
  "appliancesToInspect",
  "specialInstructions",
  "internalNotes",
  "status",
  "findings",
  "assessmentSummary",
  "recommendedSystem",
  "recommendedItems",
  "risks",
  "nextAction",
  "outcome",
  "closedReason",
  "completedAt",
  "closedAt",
  "createdById",
  "createdByName",
  "createdAt",
  "updatedAt"
`;

export const siteVisitCreateSchema = z.object({
  quoteRef: z.string().trim().max(80).optional(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(7).max(40),
  customerEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
  companyName: z.string().trim().max(160).optional(),
  siteContactPerson: z.string().trim().max(120).optional(),
  alternativePhone: z.string().trim().max(40).optional(),
  county: z.string().trim().max(120).optional(),
  town: z.string().trim().max(120).optional(),
  location: z.string().trim().max(300).optional(),
  mapUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
  landmark: z.string().trim().max(200).optional(),
  propertyType: z.string().trim().max(120).optional(),
  accessInstructions: z.string().trim().max(1000).optional(),
  projectType: z.enum(QUOTE_PROJECT_TYPES).optional(),
  visitReason: z.enum(SITE_VISIT_REASONS).optional(),
  preferredDate: z.string().trim().optional(),
  preferredTimeLabel: z.string().trim().max(80).optional(),
  scheduledAt: z.string().trim().optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  assignedStaffId: z.string().trim().optional(),
  assignedTechnicianId: z.string().trim().optional(),
  transportMethod: z.string().trim().max(120).optional(),
  visitFee: z.coerce.number().min(0).max(100000000).optional(),
  paymentStatus: z.enum(SITE_VISIT_PAYMENT_STATUSES).optional(),
  paymentReference: z.string().trim().max(160).optional(),
  customerRequirements: z.string().trim().max(4000).optional(),
  appliancesToInspect: z.string().trim().max(4000).optional(),
  specialInstructions: z.string().trim().max(4000).optional(),
  internalNotes: z.string().trim().max(4000).optional(),
});

export const siteVisitUpdateSchema = siteVisitCreateSchema.extend({
  status: z.enum(SITE_VISIT_STATUSES).optional(),
  findings: z.string().trim().max(8000).optional(),
  assessmentSummary: z.string().trim().max(8000).optional(),
  recommendedSystem: z.string().trim().max(4000).optional(),
  recommendedItems: z.string().trim().max(4000).optional(),
  risks: z.string().trim().max(4000).optional(),
  nextAction: z.string().trim().max(4000).optional(),
  outcome: z.enum(SITE_VISIT_OUTCOMES).optional().nullable(),
  closedReason: z.string().trim().max(2000).optional(),
});

function toIso(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isSiteVisitStatus(value: unknown): value is SiteVisitStatus {
  return SITE_VISIT_STATUSES.includes(String(value).trim().toUpperCase() as SiteVisitStatus);
}

function isSiteVisitReason(value: unknown): value is SiteVisitReason {
  return SITE_VISIT_REASONS.includes(String(value).trim().toUpperCase() as SiteVisitReason);
}

function isSiteVisitPaymentStatus(value: unknown): value is SiteVisitPaymentStatus {
  return SITE_VISIT_PAYMENT_STATUSES.includes(String(value).trim().toUpperCase() as SiteVisitPaymentStatus);
}

function isSiteVisitOutcome(value: unknown): value is SiteVisitOutcome {
  return SITE_VISIT_OUTCOMES.includes(String(value).trim().toUpperCase() as SiteVisitOutcome);
}

function serializeSiteVisit(row: SiteVisitRow): SerializedSiteVisit {
  return {
    id: row.id,
    visitRef: row.visitRef,
    quoteRequestId: row.quoteRequestId,
    quoteRef: row.quoteRef,
    customerUserId: row.customerUserId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    companyName: row.companyName,
    siteContactPerson: row.siteContactPerson,
    alternativePhone: row.alternativePhone,
    county: row.county,
    town: row.town,
    location: row.location,
    mapUrl: row.mapUrl,
    landmark: row.landmark,
    propertyType: row.propertyType,
    accessInstructions: row.accessInstructions,
    projectType: QUOTE_PROJECT_TYPES.includes(String(row.projectType || "").trim().toUpperCase() as QuoteProjectType)
      ? (String(row.projectType).trim().toUpperCase() as QuoteProjectType)
      : null,
    visitReason: isSiteVisitReason(row.visitReason) ? (String(row.visitReason).trim().toUpperCase() as SiteVisitReason) : null,
    preferredDate: toIso(row.preferredDate),
    preferredTimeLabel: row.preferredTimeLabel,
    scheduledAt: toIso(row.scheduledAt),
    estimatedDurationMinutes: row.estimatedDurationMinutes ?? null,
    assignedStaffId: row.assignedStaffId,
    assignedStaffName: row.assignedStaffName,
    assignedTechnicianId: row.assignedTechnicianId,
    assignedTechnicianName: row.assignedTechnicianName,
    transportMethod: row.transportMethod,
    visitFee: Number(row.visitFee ?? 0),
    paymentStatus: isSiteVisitPaymentStatus(row.paymentStatus) ? (String(row.paymentStatus).trim().toUpperCase() as SiteVisitPaymentStatus) : "UNPAID",
    paymentReference: row.paymentReference,
    customerRequirements: row.customerRequirements,
    appliancesToInspect: row.appliancesToInspect,
    specialInstructions: row.specialInstructions,
    internalNotes: row.internalNotes,
    status: isSiteVisitStatus(row.status) ? (String(row.status).trim().toUpperCase() as SiteVisitStatus) : "PENDING",
    findings: row.findings,
    assessmentSummary: row.assessmentSummary,
    recommendedSystem: row.recommendedSystem,
    recommendedItems: row.recommendedItems,
    risks: row.risks,
    nextAction: row.nextAction,
    outcome: isSiteVisitOutcome(row.outcome) ? (String(row.outcome).trim().toUpperCase() as SiteVisitOutcome) : null,
    closedReason: row.closedReason,
    completedAt: toIso(row.completedAt),
    closedAt: toIso(row.closedAt),
    createdById: row.createdById,
    createdByName: row.createdByName,
    createdAt: toIso(row.createdAt) || new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) || new Date().toISOString(),
  };
}

function serializeSiteVisitEvent(row: SiteVisitEventRow): SerializedSiteVisitEvent {
  return {
    id: row.id,
    siteVisitId: row.siteVisitId,
    eventType: row.eventType,
    eventLabel: row.eventLabel,
    eventDetail: row.eventDetail,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    metadata: row.metadata,
    createdAt: toIso(row.createdAt) || new Date().toISOString(),
  };
}

function serializeSiteVisitAttachment(row: SiteVisitAttachmentRow): SerializedSiteVisitAttachment {
  return {
    id: row.id,
    siteVisitId: row.siteVisitId,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    fileKey: row.fileKey,
    contentType: row.contentType,
    fileSizeBytes: row.fileSizeBytes ?? null,
    uploadedById: row.uploadedById,
    uploadedByName: row.uploadedByName,
    createdAt: toIso(row.createdAt) || new Date().toISOString(),
  };
}

async function recordSiteVisitEvent(input: {
  siteVisitId: string;
  eventType: string;
  eventLabel: string;
  eventDetail?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "SiteVisitEvent" (
      "id", "siteVisitId", "eventType", "eventLabel", "eventDetail", "actorUserId", "actorName", "metadata"
    )
    VALUES (
      ${randomUUID()},
      ${input.siteVisitId},
      ${input.eventType},
      ${input.eventLabel},
      ${input.eventDetail || null},
      ${input.actorUserId || null},
      ${input.actorName || null},
      ${(input.metadata || null) as Prisma.JsonObject | null}
    )
  `);
}

async function recordSiteVisitAttachmentEvent(input: {
  siteVisitId: string;
  fileName: string;
  actorUserId?: string | null;
  actorName?: string | null;
}) {
  await recordSiteVisitEvent({
    siteVisitId: input.siteVisitId,
    eventType: "SITE_VISIT_ATTACHMENT_ADDED",
    eventLabel: "Attachment added",
    eventDetail: input.fileName,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
  });
}

async function resolveUserLabels(input: { assignedStaffId?: string | null; assignedTechnicianId?: string | null }) {
  const ids = [input.assignedStaffId, input.assignedTechnicianId].filter(Boolean) as string[];
  if (!ids.length) {
    return {
      assignedStaffName: null,
      assignedTechnicianName: null,
    };
  }
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((user) => [user.id, user.name || user.email || "Staff"]));
  return {
    assignedStaffName: input.assignedStaffId ? byId.get(input.assignedStaffId) || null : null,
    assignedTechnicianName: input.assignedTechnicianId ? byId.get(input.assignedTechnicianId) || null : null,
  };
}

function buildStatusWhere(status: SiteVisitStatus | "ALL") {
  if (status === "ALL") return Prisma.empty;
  return Prisma.sql`AND "status" = ${status}`;
}

async function buildVisitRef() {
  const year = new Date().getFullYear();
  const rows = await prisma.$queryRaw<Array<{ visitRef: string }>>(Prisma.sql`
    SELECT "visitRef"
    FROM "SiteVisit"
    WHERE "visitRef" LIKE ${`SV-${year}-%`}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);
  const lastRef = rows[0]?.visitRef || "";
  const lastNumber = Number(lastRef.split("-").pop() || "0");
  return `SV-${year}-${String(lastNumber + 1).padStart(6, "0")}`;
}

export async function ensureSiteVisitsSchema() {
  if (!globalSiteVisitState.__siteVisitSchemaReady) {
    globalSiteVisitState.__siteVisitSchemaReady = (async () => {
      for (const statement of SITE_VISIT_SCHEMA_SQL) {
        await prisma.$executeRawUnsafe(statement);
      }
    })().catch((error) => {
      globalSiteVisitState.__siteVisitSchemaReady = undefined;
      throw error;
    });
  }
  await globalSiteVisitState.__siteVisitSchemaReady;
}

export async function createSiteVisit(
  input: z.infer<typeof siteVisitCreateSchema>,
  actor: { id: string; name: string | null; email: string | null },
) {
  await ensureSiteVisitsSchema();

  const linkedQuote = input.quoteRef?.trim() ? await getQuoteRequestByRef(input.quoteRef.trim()) : null;
  const userLabels = await resolveUserLabels({
    assignedStaffId: input.assignedStaffId || null,
    assignedTechnicianId: input.assignedTechnicianId || null,
  });

  const visitRef = await buildVisitRef();
  const status: SiteVisitStatus = input.scheduledAt ? "SCHEDULED" : "PENDING";
  const scheduledAt = input.scheduledAt?.trim() ? new Date(input.scheduledAt) : null;
  const preferredDate = input.preferredDate?.trim() ? new Date(`${input.preferredDate.trim()}T00:00:00.000`) : null;

  const createdRows = await prisma.$queryRaw<SiteVisitRow[]>(Prisma.sql`
    INSERT INTO "SiteVisit" (
      "id", "visitRef", "quoteRequestId", "quoteRef", "customerUserId", "customerName", "customerPhone", "customerEmail",
      "companyName", "siteContactPerson", "alternativePhone", "county", "town", "location", "mapUrl", "landmark",
      "propertyType", "accessInstructions", "projectType", "visitReason", "preferredDate", "preferredTimeLabel",
      "scheduledAt", "estimatedDurationMinutes", "assignedStaffId", "assignedStaffName", "assignedTechnicianId",
      "assignedTechnicianName", "transportMethod", "visitFee", "paymentStatus", "paymentReference", "customerRequirements",
      "appliancesToInspect", "specialInstructions", "internalNotes", "status", "createdById", "createdByName"
    )
    VALUES (
      ${randomUUID()},
      ${visitRef},
      ${linkedQuote?.id || null},
      ${linkedQuote?.quoteRef || input.quoteRef?.trim() || null},
      ${linkedQuote?.customerUserId || null},
      ${input.customerName.trim() || linkedQuote?.customerName || "Customer"},
      ${input.customerPhone.trim() || linkedQuote?.customerPhone || ""},
      ${input.customerEmail?.trim() || linkedQuote?.customerEmail || null},
      ${input.companyName?.trim() || null},
      ${input.siteContactPerson?.trim() || null},
      ${input.alternativePhone?.trim() || null},
      ${input.county?.trim() || linkedQuote?.county || null},
      ${input.town?.trim() || linkedQuote?.town || null},
      ${input.location?.trim() || linkedQuote?.customerLocation || null},
      ${input.mapUrl?.trim() || null},
      ${input.landmark?.trim() || null},
      ${input.propertyType?.trim() || linkedQuote?.propertyType || null},
      ${input.accessInstructions?.trim() || null},
      ${input.projectType || linkedQuote?.projectType || null},
      ${input.visitReason || null},
      ${preferredDate},
      ${input.preferredTimeLabel?.trim() || null},
      ${scheduledAt},
      ${input.estimatedDurationMinutes ?? null},
      ${input.assignedStaffId?.trim() || null},
      ${userLabels.assignedStaffName},
      ${input.assignedTechnicianId?.trim() || null},
      ${userLabels.assignedTechnicianName},
      ${input.transportMethod?.trim() || null},
      ${Number(input.visitFee ?? 0)},
      ${input.paymentStatus || "UNPAID"},
      ${input.paymentReference?.trim() || null},
      ${input.customerRequirements?.trim() || linkedQuote?.notes || null},
      ${input.appliancesToInspect?.trim() || linkedQuote?.loadDescription || null},
      ${input.specialInstructions?.trim() || null},
      ${input.internalNotes?.trim() || null},
      ${status},
      ${actor.id},
      ${actor.name ?? actor.email ?? "Betech Staff"}
    )
    RETURNING ${SITE_VISIT_SELECT_SQL}
  `);

  const created = createdRows[0] ? serializeSiteVisit(createdRows[0]) : null;
  if (!created) return null;

  await recordSiteVisitEvent({
    siteVisitId: created.id,
    eventType: "SITE_VISIT_CREATED",
    eventLabel: "Site visit created",
    eventDetail: created.quoteRef ? `Linked to ${created.quoteRef}` : null,
    actorUserId: actor.id,
    actorName: actor.name ?? actor.email ?? "Betech Staff",
    metadata: { status: created.status },
  });

  if (linkedQuote) {
    await recordQuotationEvent({
      quoteRequestId: linkedQuote.id,
      eventType: "SITE_VISIT_CREATED",
      eventLabel: "Site visit scheduled",
      eventDetail: `${created.visitRef}${created.scheduledAt ? " scheduled" : " requested"} for quotation follow-up`,
      actorUserId: actor.id,
      actorName: actor.name ?? actor.email ?? "Betech Staff",
      metadata: {
        siteVisitId: created.id,
        siteVisitRef: created.visitRef,
        siteVisitStatus: created.status,
      },
    });
  }

  return created;
}

export async function listAdminSiteVisits(input?: {
  status?: SiteVisitStatus | "ALL";
  q?: string;
}) {
  await ensureSiteVisitsSchema();
  const query = String(input?.q || "").trim();
  const rows = await prisma.$queryRaw<SiteVisitRow[]>(Prisma.sql`
    SELECT ${SITE_VISIT_SELECT_SQL}
    FROM "SiteVisit"
    WHERE 1 = 1
      ${buildStatusWhere(input?.status || "ALL")}
      ${
        query
          ? Prisma.sql`AND (
            "visitRef" ILIKE ${`%${query}%`}
            OR COALESCE("quoteRef", '') ILIKE ${`%${query}%`}
            OR "customerName" ILIKE ${`%${query}%`}
            OR "customerPhone" ILIKE ${`%${query}%`}
            OR COALESCE("customerEmail", '') ILIKE ${`%${query}%`}
            OR COALESCE("town", '') ILIKE ${`%${query}%`}
            OR COALESCE("county", '') ILIKE ${`%${query}%`}
          )`
          : Prisma.empty
      }
    ORDER BY COALESCE("scheduledAt", "createdAt") DESC, "updatedAt" DESC
  `);
  return rows.map(serializeSiteVisit);
}

export async function getSiteVisitById(id: string) {
  await ensureSiteVisitsSchema();
  const rows = await prisma.$queryRaw<SiteVisitRow[]>(Prisma.sql`
    SELECT ${SITE_VISIT_SELECT_SQL}
    FROM "SiteVisit"
    WHERE "id" = ${id}
    LIMIT 1
  `);
  return rows[0] ? serializeSiteVisit(rows[0]) : null;
}

export async function listSiteVisitEvents(siteVisitId: string) {
  await ensureSiteVisitsSchema();
  const rows = await prisma.$queryRaw<SiteVisitEventRow[]>(Prisma.sql`
    SELECT
      "id",
      "siteVisitId",
      "eventType",
      "eventLabel",
      "eventDetail",
      "actorUserId",
      "actorName",
      "metadata",
      "createdAt"
    FROM "SiteVisitEvent"
    WHERE "siteVisitId" = ${siteVisitId}
    ORDER BY "createdAt" DESC
  `);
  return rows.map(serializeSiteVisitEvent);
}

export async function listSiteVisitAttachments(siteVisitId: string) {
  await ensureSiteVisitsSchema();
  const rows = await prisma.$queryRaw<SiteVisitAttachmentRow[]>(Prisma.sql`
    SELECT
      "id",
      "siteVisitId",
      "fileName",
      "fileUrl",
      "fileKey",
      "contentType",
      "fileSizeBytes",
      "uploadedById",
      "uploadedByName",
      "createdAt"
    FROM "SiteVisitAttachment"
    WHERE "siteVisitId" = ${siteVisitId}
    ORDER BY "createdAt" DESC
  `);
  return rows.map(serializeSiteVisitAttachment);
}

export async function createSiteVisitAttachment(
  input: {
    siteVisitId: string;
    fileName: string;
    fileUrl: string;
    fileKey?: string | null;
    contentType?: string | null;
    fileSizeBytes?: number | null;
  },
  actor: { id: string; name: string | null; email: string | null },
) {
  await ensureSiteVisitsSchema();
  const rows = await prisma.$queryRaw<SiteVisitAttachmentRow[]>(Prisma.sql`
    INSERT INTO "SiteVisitAttachment" (
      "id",
      "siteVisitId",
      "fileName",
      "fileUrl",
      "fileKey",
      "contentType",
      "fileSizeBytes",
      "uploadedById",
      "uploadedByName"
    )
    VALUES (
      ${randomUUID()},
      ${input.siteVisitId},
      ${input.fileName},
      ${input.fileUrl},
      ${input.fileKey || null},
      ${input.contentType || null},
      ${input.fileSizeBytes ?? null},
      ${actor.id},
      ${actor.name ?? actor.email ?? "Betech Staff"}
    )
    RETURNING
      "id",
      "siteVisitId",
      "fileName",
      "fileUrl",
      "fileKey",
      "contentType",
      "fileSizeBytes",
      "uploadedById",
      "uploadedByName",
      "createdAt"
  `);

  const attachment = rows[0] ? serializeSiteVisitAttachment(rows[0]) : null;
  if (!attachment) return null;

  await recordSiteVisitAttachmentEvent({
    siteVisitId: input.siteVisitId,
    fileName: input.fileName,
    actorUserId: actor.id,
    actorName: actor.name ?? actor.email ?? "Betech Staff",
  });

  return attachment;
}

export async function updateSiteVisit(
  id: string,
  input: z.infer<typeof siteVisitUpdateSchema>,
  actor: { id: string; name: string | null; email: string | null },
) {
  await ensureSiteVisitsSchema();
  const existing = await getSiteVisitById(id);
  if (!existing) return null;

  const linkedQuote = input.quoteRef?.trim() ? await getQuoteRequestByRef(input.quoteRef.trim()) : null;
  const userLabels = await resolveUserLabels({
    assignedStaffId: input.assignedStaffId !== undefined ? input.assignedStaffId || null : existing.assignedStaffId,
    assignedTechnicianId: input.assignedTechnicianId !== undefined ? input.assignedTechnicianId || null : existing.assignedTechnicianId,
  });

  const nextStatus = input.status || existing.status;
  const nextOutcome = input.outcome === null ? null : input.outcome ?? existing.outcome;
  const scheduledAt = input.scheduledAt !== undefined
    ? (input.scheduledAt?.trim() ? new Date(input.scheduledAt) : null)
    : (existing.scheduledAt ? new Date(existing.scheduledAt) : null);
  const preferredDate = input.preferredDate !== undefined
    ? (input.preferredDate?.trim() ? new Date(`${input.preferredDate.trim()}T00:00:00.000`) : null)
    : (existing.preferredDate ? new Date(existing.preferredDate) : null);
  const completedAt = nextStatus === "VISITED" && !existing.completedAt ? new Date() : existing.completedAt ? new Date(existing.completedAt) : null;
  const closedAt = nextStatus === "CLOSED" && !existing.closedAt ? new Date() : existing.closedAt ? new Date(existing.closedAt) : null;

  const updatedRows = await prisma.$queryRaw<SiteVisitRow[]>(Prisma.sql`
    UPDATE "SiteVisit"
    SET
      "quoteRequestId" = ${linkedQuote?.id || existing.quoteRequestId},
      "quoteRef" = ${linkedQuote?.quoteRef || input.quoteRef?.trim() || existing.quoteRef},
      "customerUserId" = ${linkedQuote?.customerUserId || existing.customerUserId},
      "customerName" = ${input.customerName?.trim() || existing.customerName},
      "customerPhone" = ${input.customerPhone?.trim() || existing.customerPhone},
      "customerEmail" = ${input.customerEmail?.trim() || existing.customerEmail},
      "companyName" = ${input.companyName?.trim() || existing.companyName},
      "siteContactPerson" = ${input.siteContactPerson?.trim() || existing.siteContactPerson},
      "alternativePhone" = ${input.alternativePhone?.trim() || existing.alternativePhone},
      "county" = ${input.county?.trim() || existing.county},
      "town" = ${input.town?.trim() || existing.town},
      "location" = ${input.location?.trim() || existing.location},
      "mapUrl" = ${input.mapUrl?.trim() || existing.mapUrl},
      "landmark" = ${input.landmark?.trim() || existing.landmark},
      "propertyType" = ${input.propertyType?.trim() || existing.propertyType},
      "accessInstructions" = ${input.accessInstructions?.trim() || existing.accessInstructions},
      "projectType" = ${input.projectType || existing.projectType},
      "visitReason" = ${input.visitReason || existing.visitReason},
      "preferredDate" = ${preferredDate},
      "preferredTimeLabel" = ${input.preferredTimeLabel?.trim() || existing.preferredTimeLabel},
      "scheduledAt" = ${scheduledAt},
      "estimatedDurationMinutes" = ${input.estimatedDurationMinutes ?? existing.estimatedDurationMinutes},
      "assignedStaffId" = ${input.assignedStaffId?.trim() || existing.assignedStaffId},
      "assignedStaffName" = ${userLabels.assignedStaffName || existing.assignedStaffName},
      "assignedTechnicianId" = ${input.assignedTechnicianId?.trim() || existing.assignedTechnicianId},
      "assignedTechnicianName" = ${userLabels.assignedTechnicianName || existing.assignedTechnicianName},
      "transportMethod" = ${input.transportMethod?.trim() || existing.transportMethod},
      "visitFee" = ${input.visitFee ?? existing.visitFee},
      "paymentStatus" = ${input.paymentStatus || existing.paymentStatus},
      "paymentReference" = ${input.paymentReference?.trim() || existing.paymentReference},
      "customerRequirements" = ${input.customerRequirements?.trim() || existing.customerRequirements},
      "appliancesToInspect" = ${input.appliancesToInspect?.trim() || existing.appliancesToInspect},
      "specialInstructions" = ${input.specialInstructions?.trim() || existing.specialInstructions},
      "internalNotes" = ${input.internalNotes?.trim() || existing.internalNotes},
      "status" = ${nextStatus},
      "findings" = ${input.findings?.trim() || existing.findings},
      "assessmentSummary" = ${input.assessmentSummary?.trim() || existing.assessmentSummary},
      "recommendedSystem" = ${input.recommendedSystem?.trim() || existing.recommendedSystem},
      "recommendedItems" = ${input.recommendedItems?.trim() || existing.recommendedItems},
      "risks" = ${input.risks?.trim() || existing.risks},
      "nextAction" = ${input.nextAction?.trim() || existing.nextAction},
      "outcome" = ${nextOutcome},
      "closedReason" = ${input.closedReason?.trim() || existing.closedReason},
      "completedAt" = ${completedAt},
      "closedAt" = ${closedAt},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING ${SITE_VISIT_SELECT_SQL}
  `);

  const updated = updatedRows[0] ? serializeSiteVisit(updatedRows[0]) : null;
  if (!updated) return null;

  await recordSiteVisitEvent({
    siteVisitId: updated.id,
    eventType: "SITE_VISIT_UPDATED",
    eventLabel: nextStatus !== existing.status ? `Status changed to ${nextStatus}` : "Site visit updated",
    eventDetail: nextOutcome && nextOutcome !== existing.outcome ? `Outcome: ${nextOutcome.replace(/_/g, " ").toLowerCase()}` : null,
    actorUserId: actor.id,
    actorName: actor.name ?? actor.email ?? "Betech Staff",
    metadata: {
      previousStatus: existing.status,
      status: updated.status,
      outcome: updated.outcome,
    },
  });

  if (updated.quoteRequestId && (updated.status !== existing.status || updated.outcome !== existing.outcome)) {
    await recordQuotationEvent({
      quoteRequestId: updated.quoteRequestId,
      eventType: "SITE_VISIT_UPDATED",
      eventLabel: `Site visit ${updated.status.toLowerCase()}`,
      eventDetail: `${updated.visitRef}${updated.outcome ? ` · ${updated.outcome.replace(/_/g, " ").toLowerCase()}` : ""}`,
      actorUserId: actor.id,
      actorName: actor.name ?? actor.email ?? "Betech Staff",
      metadata: {
        siteVisitId: updated.id,
        siteVisitRef: updated.visitRef,
        siteVisitStatus: updated.status,
        siteVisitOutcome: updated.outcome,
      },
    });
  }

  return updated;
}

export async function listCustomerSiteVisits(input: {
  userId: string;
  phoneVariants: string[];
  normalizedEmails: string[];
  take?: number;
}) {
  await ensureSiteVisitsSchema();
  const conditions: Prisma.Sql[] = [Prisma.sql`"customerUserId" = ${input.userId}`];
  const phoneVariants = [...new Set(input.phoneVariants.map((value) => String(value || "").trim()).filter(Boolean))];
  const normalizedEmails = [...new Set(input.normalizedEmails.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))];
  if (phoneVariants.length) {
    conditions.push(Prisma.sql`"customerPhone" IN (${Prisma.join(phoneVariants)})`);
  }
  if (normalizedEmails.length) {
    conditions.push(Prisma.sql`LOWER(COALESCE("customerEmail", '')) IN (${Prisma.join(normalizedEmails)})`);
  }
  const take = Math.max(1, Math.min(20, Number(input.take ?? 5)));
  const rows = await prisma.$queryRaw<SiteVisitRow[]>(Prisma.sql`
    SELECT ${SITE_VISIT_SELECT_SQL}
    FROM "SiteVisit"
    WHERE (${Prisma.join(conditions, " OR ")})
    ORDER BY COALESCE("scheduledAt", "createdAt") DESC
    LIMIT ${take}
  `);
  return rows.map(serializeSiteVisit);
}
