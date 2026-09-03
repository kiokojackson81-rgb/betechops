import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { extractMpesaTransactionCode } from "@/lib/mpesaReference";
import { prisma } from "@/lib/prisma";
import {
  QUOTE_PROJECT_TYPES,
  type QuoteProjectType,
  createQuoteRequest,
  getQuoteRequestByRef,
  recordQuotationEvent,
} from "@/lib/quoteRequests";
import {
  SITE_VISIT_OUTCOMES,
  DATA_LOGGER_STATUSES,
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
  type DataLoggerStatus,
} from "@/lib/siteVisitShared";
import {
  calculateDataLoggerFee,
  DATA_LOGGER_DAILY_RATE,
  deriveSiteVisitCreditStatus,
  getSiteVisitFeeRegion,
  getStandardSiteVisitFee,
  validateSiteVisitLifecycle,
} from "@/lib/siteVisitPolicy";
import { getServiceZone } from "@/lib/agents/kenyaMarkets";

export {
  SITE_VISIT_OUTCOMES,
  SITE_VISIT_PAYMENT_STATUSES,
  SITE_VISIT_REASONS,
  SITE_VISIT_STATUSES,
};

export { DATA_LOGGER_DAILY_RATE } from "@/lib/siteVisitPolicy";
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
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'STAFF'`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "feeRegion" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "serviceZone" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "serviceZoneLabel" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "locationCounty" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "locationTown" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "appliedFee" DOUBLE PRECISION`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "originProductId" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "bookingAttemptId" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "originProductName" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "originProductSlug" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "originProductPrice" DOUBLE PRECISION`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "originProductCategory" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "originProductImage" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "originProductUrl" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "dataLoggerRequested" BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "dataLoggerDays" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "dataLoggerDailyRate" DOUBLE PRECISION NOT NULL DEFAULT 5000`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "dataLoggerFee" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "dataLoggerStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED'`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "dataLoggerInstalledAt" TIMESTAMP(3)`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "dataLoggerExpectedEndAt" TIMESTAMP(3)`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "dataLoggerCompletedAt" TIMESTAMP(3)`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "totalPayable" DOUBLE PRECISION`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "standardVisitFee" DOUBLE PRECISION`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "feeOverrideReason" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentAmount" DOUBLE PRECISION`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentSubmittedAt" TIMESTAMP(3)`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentPaidAt" TIMESTAMP(3)`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentRecordedById" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentRecordedByName" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentVerificationStatus" TEXT NOT NULL DEFAULT 'NONE'`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "waiverReason" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "waiverAuthorizedById" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "waiverAuthorizedByName" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "quotationCreditStatus" TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE'`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditedQuotationId" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditedQuotationRef" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditedAmount" DOUBLE PRECISION`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditedAt" TIMESTAMP(3)`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditAppliedById" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditAppliedByName" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "rescheduleRequestedAt" TIMESTAMP(3)`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "rescheduleRequestedDate" TIMESTAMP(3)`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "rescheduleRequestedTimeLabel" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "rescheduleReason" TEXT`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "cancellationRequestedAt" TIMESTAMP(3)`,
  `ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_status_scheduledAt_idx" ON "SiteVisit"("status","scheduledAt")`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_customerUserId_createdAt_idx" ON "SiteVisit"("customerUserId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_customerPhone_createdAt_idx" ON "SiteVisit"("customerPhone","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_quoteRequestId_createdAt_idx" ON "SiteVisit"("quoteRequestId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_assignedStaffId_scheduledAt_idx" ON "SiteVisit"("assignedStaffId","scheduledAt")`,
  `CREATE INDEX IF NOT EXISTS "SiteVisit_assignedTechnicianId_scheduledAt_idx" ON "SiteVisit"("assignedTechnicianId","scheduledAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SiteVisit_bookingAttemptId_key" ON "SiteVisit"("bookingAttemptId")`,
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
  `CREATE TABLE IF NOT EXISTS "SiteVisitNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteVisitId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "SiteVisitNotification_siteVisitId_createdAt_idx" ON "SiteVisitNotification"("siteVisitId","createdAt")`,
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
    -- Technicians can be internal users or external agents, so this column
    -- cannot reference only the User table.
    ALTER TABLE "SiteVisit" DROP CONSTRAINT IF EXISTS "SiteVisit_assignedTechnicianId_fkey";
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
  source: string;
  feeRegion: string | null;
  serviceZone: string | null;
  serviceZoneLabel: string | null;
  locationCounty: string | null;
  locationTown: string | null;
  appliedFee: number | null;
  originProductId: string | null;
  originProductName: string | null;
  originProductSlug: string | null;
  originProductPrice: number | null;
  originProductCategory: string | null;
  originProductImage: string | null;
  originProductUrl: string | null;
  dataLoggerRequested: boolean;
  dataLoggerDays: number;
  dataLoggerDailyRate: number;
  dataLoggerFee: number;
  dataLoggerStatus: string;
  dataLoggerInstalledAt: Date | null;
  dataLoggerExpectedEndAt: Date | null;
  dataLoggerCompletedAt: Date | null;
  totalPayable: number | null;
  standardVisitFee: number | null;
  feeOverrideReason: string | null;
  paymentMethod: string | null;
  paymentAmount: number | null;
  paymentSubmittedAt: Date | string | null;
  paymentPaidAt: Date | string | null;
  paymentRecordedById: string | null;
  paymentRecordedByName: string | null;
  paymentVerificationStatus: string;
  waiverReason: string | null;
  waiverAuthorizedById: string | null;
  waiverAuthorizedByName: string | null;
  quotationCreditStatus: string;
  creditedQuotationId: string | null;
  creditedQuotationRef: string | null;
  creditedAmount: number | null;
  creditedAt: Date | string | null;
  creditAppliedById: string | null;
  creditAppliedByName: string | null;
  rescheduleRequestedAt: Date | string | null;
  rescheduleRequestedDate: Date | string | null;
  rescheduleRequestedTimeLabel: string | null;
  rescheduleReason: string | null;
  cancellationRequestedAt: Date | string | null;
  cancellationReason: string | null;
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
  "source",
  "feeRegion",
  "serviceZone",
  "serviceZoneLabel",
  "locationCounty",
  "locationTown",
  "appliedFee",
  "originProductId",
  "originProductName",
  "originProductSlug",
  "originProductPrice",
  "originProductCategory",
  "originProductImage",
  "originProductUrl",
  "dataLoggerRequested",
  "dataLoggerDays",
  "dataLoggerDailyRate",
  "dataLoggerFee",
  "dataLoggerStatus",
  "dataLoggerInstalledAt",
  "dataLoggerExpectedEndAt",
  "dataLoggerCompletedAt",
  "totalPayable",
  "standardVisitFee",
  "feeOverrideReason",
  "paymentMethod",
  "paymentAmount",
  "paymentSubmittedAt",
  "paymentPaidAt",
  "paymentRecordedById",
  "paymentRecordedByName",
  "paymentVerificationStatus",
  "waiverReason",
  "waiverAuthorizedById",
  "waiverAuthorizedByName",
  "quotationCreditStatus",
  "creditedQuotationId",
  "creditedQuotationRef",
  "creditedAmount",
  "creditedAt",
  "creditAppliedById",
  "creditAppliedByName",
  "rescheduleRequestedAt",
  "rescheduleRequestedDate",
  "rescheduleRequestedTimeLabel",
  "rescheduleReason",
  "cancellationRequestedAt",
  "cancellationReason",
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
  bookingAttemptId: z.string().uuid().optional(),
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
  source: z.enum(["STAFF", "CUSTOMER_REQUEST"]).optional(),
  feeOverrideReason: z.string().trim().max(500).optional(),
  paymentMethod: z.string().trim().max(80).optional(),
  paymentAmount: z.coerce.number().min(0).max(100000000).optional(),
  waiverReason: z.string().trim().max(500).optional(),
  customerRequirements: z.string().trim().max(4000).optional(),
  appliancesToInspect: z.string().trim().max(4000).optional(),
  specialInstructions: z.string().trim().max(4000).optional(),
  internalNotes: z.string().trim().max(4000).optional(),
  originProductId: z.string().trim().max(160).optional(),
  originProductName: z.string().trim().max(500).optional(),
  originProductSlug: z.string().trim().max(240).optional(),
  originProductPrice: z.coerce.number().min(0).max(100000000).optional(),
  originProductCategory: z.string().trim().max(160).optional(),
  originProductImage: z.string().trim().max(2000).optional(),
  originProductUrl: z.string().trim().max(2000).optional(),
  dataLoggerRequested: z.boolean().optional(),
  dataLoggerDays: z.coerce.number().int().min(1).max(3).optional(),
  dataLoggerStatus: z.enum(DATA_LOGGER_STATUSES).optional(),
  dataLoggerInstalledAt: z.string().trim().optional(),
  dataLoggerExpectedEndAt: z.string().trim().optional(),
  dataLoggerCompletedAt: z.string().trim().optional(),
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

export const customerSiteVisitCreateSchema = z.object({
  bookingAttemptId: z.string().uuid().optional(),
  projectType: z.enum(QUOTE_PROJECT_TYPES),
  visitReason: z.enum(SITE_VISIT_REASONS),
  customerRequirements: z.string().trim().min(10).max(4000),
  county: z.string().trim().min(2).max(120),
  town: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(300),
  landmark: z.string().trim().max(200).optional(),
  mapUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
  propertyType: z.string().trim().max(120).optional(),
  alternativePhone: z.string().trim().max(80).optional(),
  appliancesToInspect: z.string().trim().max(2000).optional(),
  accessInstructions: z.string().trim().max(1000).optional(),
  specialInstructions: z.string().trim().max(2000).optional(),
  preferredDate: z.string().trim().min(1),
  preferredTimeLabel: z.enum(["MORNING", "AFTERNOON"]),
  originProductId: z.string().trim().max(160).optional(),
  originProductSlug: z.string().trim().max(240).optional(),
  dataLoggerRequested: z.boolean().optional(),
  dataLoggerDays: z.coerce.number().int().min(1).max(3).optional(),
});

export const customerSiteVisitActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REQUEST_RESCHEDULE"),
    preferredDate: z.string().trim().min(1),
    preferredTimeLabel: z.enum(["MORNING", "AFTERNOON"]),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("UPDATE_LOCATION"),
    county: z.string().trim().min(2).max(120),
    town: z.string().trim().min(2).max(120),
    location: z.string().trim().min(2).max(300),
    landmark: z.string().trim().max(200).optional(),
    mapUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
  }),
  z.object({
    action: z.literal("REQUEST_CANCELLATION"),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("SUBMIT_PAYMENT"),
    paymentMethod: z.string().trim().min(2).max(80),
    paymentReference: z.string().trim().min(5).max(160),
  }),
]);

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
    source: row.source === "CUSTOMER_REQUEST" ? "CUSTOMER_REQUEST" : "STAFF",
    feeRegion: row.feeRegion === "ZONE_1" || row.feeRegion === "ZONE_2" || row.feeRegion === "ZONE_3" ? row.feeRegion : null,
    serviceZone: row.serviceZone === "ZONE_1" || row.serviceZone === "ZONE_2" || row.serviceZone === "ZONE_3" ? row.serviceZone : null,
    serviceZoneLabel: row.serviceZoneLabel,
    locationCounty: row.locationCounty,
    locationTown: row.locationTown,
    appliedFee: Number(row.appliedFee ?? row.visitFee ?? 0),
    originProductId: row.originProductId,
    originProductName: row.originProductName,
    originProductSlug: row.originProductSlug,
    originProductPrice: row.originProductPrice == null ? null : Number(row.originProductPrice),
    originProductCategory: row.originProductCategory,
    originProductImage: row.originProductImage,
    originProductUrl: row.originProductUrl,
    dataLoggerRequested: Boolean(row.dataLoggerRequested),
    dataLoggerDays: Number(row.dataLoggerDays || 0),
    dataLoggerDailyRate: Number(row.dataLoggerDailyRate || DATA_LOGGER_DAILY_RATE),
    dataLoggerFee: Number(row.dataLoggerFee || 0),
    dataLoggerStatus: isDataLoggerStatus(row.dataLoggerStatus) ? (String(row.dataLoggerStatus).trim().toUpperCase() as DataLoggerStatus) : "NOT_REQUESTED",
    dataLoggerInstalledAt: toIso(row.dataLoggerInstalledAt),
    dataLoggerExpectedEndAt: toIso(row.dataLoggerExpectedEndAt),
    dataLoggerCompletedAt: toIso(row.dataLoggerCompletedAt),
    totalPayable: Number(row.totalPayable ?? row.visitFee ?? 0),
    standardVisitFee: row.standardVisitFee == null ? null : Number(row.standardVisitFee),
    feeOverrideReason: row.feeOverrideReason,
    paymentMethod: row.paymentMethod,
    paymentAmount: row.paymentAmount == null ? null : Number(row.paymentAmount),
    paymentSubmittedAt: toIso(row.paymentSubmittedAt),
    paymentPaidAt: toIso(row.paymentPaidAt),
    paymentRecordedById: row.paymentRecordedById,
    paymentRecordedByName: row.paymentRecordedByName,
    paymentVerificationStatus:
      row.paymentVerificationStatus === "PENDING" || row.paymentVerificationStatus === "VERIFIED" || row.paymentVerificationStatus === "REJECTED"
        ? row.paymentVerificationStatus
        : "NONE",
    waiverReason: row.waiverReason,
    waiverAuthorizedById: row.waiverAuthorizedById,
    waiverAuthorizedByName: row.waiverAuthorizedByName,
    quotationCreditStatus:
      row.quotationCreditStatus === "AVAILABLE" || row.quotationCreditStatus === "APPLIED"
        ? row.quotationCreditStatus
        : "NOT_ELIGIBLE",
    creditedQuotationId: row.creditedQuotationId,
    creditedQuotationRef: row.creditedQuotationRef,
    creditedAmount: row.creditedAmount == null ? null : Number(row.creditedAmount),
    creditedAt: toIso(row.creditedAt),
    creditAppliedById: row.creditAppliedById,
    creditAppliedByName: row.creditAppliedByName,
    rescheduleRequestedAt: toIso(row.rescheduleRequestedAt),
    rescheduleRequestedDate: toIso(row.rescheduleRequestedDate),
    rescheduleRequestedTimeLabel: row.rescheduleRequestedTimeLabel,
    rescheduleReason: row.rescheduleReason,
    cancellationRequestedAt: toIso(row.cancellationRequestedAt),
    cancellationReason: row.cancellationReason,
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
  const ids = [input.assignedStaffId, input.assignedTechnicianId]
    .filter((id): id is string => Boolean(id) && !String(id).startsWith("external:"));
  const externalTechnicianId = input.assignedTechnicianId?.startsWith("external:")
    ? input.assignedTechnicianId.slice("external:".length)
    : null;
  if (!ids.length) {
    const externalTechnician = externalTechnicianId
      ? await prisma.projectExternalAgent.findFirst({ where: { id: externalTechnicianId, isActive: true }, select: { name: true } })
      : null;
    return { assignedStaffName: null, assignedTechnicianName: externalTechnician?.name || null };
  }
  const [users, externalTechnician] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }),
    externalTechnicianId
      ? prisma.projectExternalAgent.findFirst({ where: { id: externalTechnicianId, isActive: true }, select: { name: true } })
      : Promise.resolve(null),
  ]);
  const byId = new Map(users.map((user) => [user.id, user.name || user.email || "Staff"]));
  return {
    assignedStaffName: input.assignedStaffId ? byId.get(input.assignedStaffId) || null : null,
    assignedTechnicianName: externalTechnicianId
      ? externalTechnician?.name || null
      : input.assignedTechnicianId ? byId.get(input.assignedTechnicianId) || null : null,
  };
}

function toValidDate(value: string | Date | null | undefined) {
  const iso = toIso(value);
  return iso ? new Date(iso) : null;
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
  actor: { id: string; name: string | null; email: string | null; customerUserId?: string | null },
) {
  await ensureSiteVisitsSchema();

  if (input.bookingAttemptId && actor.customerUserId) {
    const existingAttempt = await prisma.$queryRaw<SiteVisitRow[]>(Prisma.sql`
      SELECT ${SITE_VISIT_SELECT_SQL}
      FROM "SiteVisit"
      WHERE "bookingAttemptId" = ${input.bookingAttemptId}
        AND "customerUserId" = ${actor.customerUserId}
      LIMIT 1
    `);
    if (existingAttempt[0]) return serializeSiteVisit(existingAttempt[0]);
  }

  const linkedQuote = input.quoteRef?.trim() ? await getQuoteRequestByRef(input.quoteRef.trim()) : null;
  const userLabels = await resolveUserLabels({
    assignedStaffId: input.assignedStaffId || null,
    assignedTechnicianId: input.assignedTechnicianId || null,
  });

  const visitRef = await buildVisitRef();
  const status: SiteVisitStatus = input.scheduledAt ? "SCHEDULED" : "PENDING";
  const scheduledAt = input.scheduledAt?.trim() ? new Date(input.scheduledAt) : null;
  const preferredDate = input.preferredDate?.trim() ? new Date(`${input.preferredDate.trim()}T00:00:00.000`) : null;
  const effectiveCounty = input.county?.trim() || linkedQuote?.county || null;
  const effectiveTown = input.town?.trim() || linkedQuote?.town || null;
  const zone = getServiceZone(effectiveCounty, effectiveTown);
  if (!zone) throw new Error("Select a recognized county and town before creating the Site Visit.");
  const standardVisitFee = getStandardSiteVisitFee(effectiveCounty, effectiveTown);
  const visitFee = input.visitFee ?? standardVisitFee ?? 0;
  const feeRegion = getSiteVisitFeeRegion(effectiveCounty, effectiveTown);
  const dataLoggerRequested = Boolean(input.dataLoggerRequested);
  const loggerPricing = calculateDataLoggerFee(dataLoggerRequested, input.dataLoggerDays);
  const dataLoggerDays = loggerPricing.days;
  const dataLoggerFee = loggerPricing.fee;
  const totalPayable = Number(visitFee) + dataLoggerFee;

  const createdRows = await prisma.$queryRaw<SiteVisitRow[]>(Prisma.sql`
    INSERT INTO "SiteVisit" (
      "id", "visitRef", "bookingAttemptId", "quoteRequestId", "quoteRef", "customerUserId", "customerName", "customerPhone", "customerEmail",
      "companyName", "siteContactPerson", "alternativePhone", "county", "town", "location", "mapUrl", "landmark",
      "propertyType", "accessInstructions", "projectType", "visitReason", "preferredDate", "preferredTimeLabel",
      "scheduledAt", "estimatedDurationMinutes", "assignedStaffId", "assignedStaffName", "assignedTechnicianId",
      "assignedTechnicianName", "transportMethod", "visitFee", "paymentStatus", "paymentReference", "source", "feeRegion",
      "serviceZone", "serviceZoneLabel", "locationCounty", "locationTown", "appliedFee",
      "originProductId", "originProductName", "originProductSlug", "originProductPrice", "originProductCategory",
      "originProductImage", "originProductUrl", "dataLoggerRequested", "dataLoggerDays", "dataLoggerDailyRate",
      "dataLoggerFee", "dataLoggerStatus", "dataLoggerInstalledAt", "dataLoggerExpectedEndAt", "dataLoggerCompletedAt", "totalPayable",
      "standardVisitFee", "feeOverrideReason", "paymentMethod", "paymentAmount", "paymentPaidAt", "paymentRecordedById",
      "paymentRecordedByName", "paymentVerificationStatus", "waiverReason", "waiverAuthorizedById", "waiverAuthorizedByName",
      "quotationCreditStatus", "customerRequirements",
      "appliancesToInspect", "specialInstructions", "internalNotes", "status", "createdById", "createdByName"
    )
    VALUES (
      ${randomUUID()},
      ${visitRef},
      ${input.bookingAttemptId || null},
      ${linkedQuote?.id || null},
      ${linkedQuote?.quoteRef || input.quoteRef?.trim() || null},
      ${linkedQuote?.customerUserId || actor.customerUserId || null},
      ${input.customerName.trim() || linkedQuote?.customerName || "Customer"},
      ${input.customerPhone.trim() || linkedQuote?.customerPhone || ""},
      ${input.customerEmail?.trim() || linkedQuote?.customerEmail || null},
      ${input.companyName?.trim() || null},
      ${input.siteContactPerson?.trim() || null},
      ${input.alternativePhone?.trim() || null},
      ${effectiveCounty},
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
      ${Number(visitFee)},
      ${input.paymentStatus || "UNPAID"},
      ${input.paymentReference?.trim() || null},
      ${input.source || "STAFF"},
      ${feeRegion},
      ${zone.id},
      ${zone.name},
      ${effectiveCounty},
      ${effectiveTown},
      ${Number(visitFee)},
      ${input.originProductId?.trim() || null},
      ${input.originProductName?.trim() || null},
      ${input.originProductSlug?.trim() || null},
      ${input.originProductPrice ?? null},
      ${input.originProductCategory?.trim() || null},
      ${input.originProductImage?.trim() || null},
      ${input.originProductUrl?.trim() || null},
      ${dataLoggerRequested},
      ${dataLoggerDays},
      ${DATA_LOGGER_DAILY_RATE},
      ${dataLoggerFee},
      ${dataLoggerRequested ? "REQUESTED" : "NOT_REQUESTED"},
      ${input.dataLoggerInstalledAt ? new Date(input.dataLoggerInstalledAt) : null},
      ${input.dataLoggerExpectedEndAt ? new Date(input.dataLoggerExpectedEndAt) : null},
      ${input.dataLoggerCompletedAt ? new Date(input.dataLoggerCompletedAt) : null},
      ${totalPayable},
      ${standardVisitFee},
      ${input.feeOverrideReason?.trim() || null},
      ${input.paymentMethod?.trim() || null},
      ${input.paymentStatus === "PAID" ? Number(input.paymentAmount ?? visitFee) : null},
      ${input.paymentStatus === "PAID" ? new Date() : null},
      ${input.paymentStatus === "PAID" ? actor.id : null},
      ${input.paymentStatus === "PAID" ? actor.name ?? actor.email ?? "Betech Staff" : null},
      ${input.paymentStatus === "PAID" ? "VERIFIED" : "NONE"},
      ${input.waiverReason?.trim() || null},
      ${input.paymentStatus === "WAIVED" ? actor.id : null},
      ${input.paymentStatus === "WAIVED" ? actor.name ?? actor.email ?? "Betech Staff" : null},
      ${deriveSiteVisitCreditStatus({ paymentStatus: input.paymentStatus || "UNPAID" })},
      ${input.customerRequirements?.trim() || linkedQuote?.notes || null},
      ${input.appliancesToInspect?.trim() || linkedQuote?.loadDescription || null},
      ${input.specialInstructions?.trim() || null},
      ${input.internalNotes?.trim() || null},
      ${status},
      ${actor.id},
      ${actor.name ?? actor.email ?? "Betech Staff"}
    )
    ON CONFLICT ("bookingAttemptId") DO UPDATE SET "bookingAttemptId" = EXCLUDED."bookingAttemptId"
      WHERE "SiteVisit"."customerUserId" = EXCLUDED."customerUserId"
    RETURNING ${SITE_VISIT_SELECT_SQL}
  `);

  const created = createdRows[0] ? serializeSiteVisit(createdRows[0]) : null;
  if (!created) return null;

  await recordSiteVisitEvent({
    siteVisitId: created.id,
    eventType: "SITE_VISIT_CREATED",
    eventLabel: "Site visit created",
    eventDetail: `${created.source === "CUSTOMER_REQUEST" ? "Customer request" : "Staff booking"} · Fee KES ${created.visitFee.toLocaleString("en-KE")}${created.quoteRef ? ` · Linked to ${created.quoteRef}` : ""}`,
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
  assignedUserId?: string | null;
}) {
  await ensureSiteVisitsSchema();
  const query = String(input?.q || "").trim();
  const rows = await prisma.$queryRaw<SiteVisitRow[]>(Prisma.sql`
    SELECT ${SITE_VISIT_SELECT_SQL}
    FROM "SiteVisit"
    WHERE 1 = 1
      ${buildStatusWhere(input?.status || "ALL")}
      ${input?.assignedUserId ? Prisma.sql`AND ("assignedStaffId" = ${input.assignedUserId} OR "assignedTechnicianId" = ${input.assignedUserId})` : Prisma.empty}
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

export async function deleteSiteVisit(id: string) {
  await ensureSiteVisitsSchema();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`DELETE FROM "SiteVisitNotification" WHERE "siteVisitId" = ${id}`,
    );
    await tx.$executeRaw(
      Prisma.sql`DELETE FROM "SiteVisitAttachment" WHERE "siteVisitId" = ${id}`,
    );
    await tx.$executeRaw(
      Prisma.sql`DELETE FROM "SiteVisitEvent" WHERE "siteVisitId" = ${id}`,
    );
    return tx.$executeRaw(
      Prisma.sql`DELETE FROM "SiteVisit" WHERE "id" = ${id}`,
    );
  });
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
  const nextAssignedStaffId = input.assignedStaffId !== undefined
    ? input.assignedStaffId.trim() || null
    : existing.assignedStaffId;
  const nextAssignedTechnicianId = input.assignedTechnicianId !== undefined
    ? input.assignedTechnicianId.trim() || null
    : existing.assignedTechnicianId;
  const userLabels = await resolveUserLabels({
    assignedStaffId: nextAssignedStaffId,
    assignedTechnicianId: nextAssignedTechnicianId,
  });

  const nextStatus = input.status || existing.status;
  const nextOutcome = input.outcome === null ? null : input.outcome ?? existing.outcome;
  const lifecycleError = validateSiteVisitLifecycle({
    previousStatus: existing.status,
    status: nextStatus,
    outcome: nextOutcome,
    closedReason: input.closedReason ?? existing.closedReason,
  });
  if (lifecycleError) throw new Error(lifecycleError);
  if (input.paymentStatus === "PAID" && !String(input.paymentReference || existing.paymentReference || "").trim()) {
    throw new Error("A payment reference is required before marking the visit fee paid.");
  }
  if (input.paymentStatus === "WAIVED" && !String(input.waiverReason || existing.waiverReason || "").trim()) {
    throw new Error("A waiver reason is required before waiving the visit fee.");
  }
  const scheduledAt = input.scheduledAt !== undefined
    ? toValidDate(input.scheduledAt)
    : toValidDate(existing.scheduledAt);
  const preferredDate = input.preferredDate !== undefined
    ? toValidDate(input.preferredDate?.trim() ? `${input.preferredDate.trim()}T00:00:00.000` : null)
    : toValidDate(existing.preferredDate);
  const completedAt =
    nextStatus === "VISITED" || nextStatus === "CLOSED"
      ? (toValidDate(existing.completedAt) || new Date())
      : null;
  const closedAt = nextStatus === "CLOSED" ? (toValidDate(existing.closedAt) || new Date()) : null;
  const nextPaymentStatus = input.paymentStatus || existing.paymentStatus;
  const nextDataLoggerRequested = input.dataLoggerRequested ?? existing.dataLoggerRequested;
  const nextDataLoggerDays = nextDataLoggerRequested
    ? Math.max(1, Math.min(3, Number(input.dataLoggerDays ?? existing.dataLoggerDays ?? 1)))
    : 0;
  const nextDataLoggerFee = nextDataLoggerDays * DATA_LOGGER_DAILY_RATE;
  const nextDataLoggerStatus = input.dataLoggerStatus || existing.dataLoggerStatus;
  const loggerInstalledAt = input.dataLoggerInstalledAt
    ? toValidDate(input.dataLoggerInstalledAt)
    : existing.dataLoggerInstalledAt
      ? toValidDate(existing.dataLoggerInstalledAt)
      : (["INSTALLED", "MONITORING", "COMPLETED"] as DataLoggerStatus[]).includes(nextDataLoggerStatus)
        ? new Date()
        : null;
  const loggerExpectedEndAt = input.dataLoggerExpectedEndAt
    ? toValidDate(input.dataLoggerExpectedEndAt)
    : existing.dataLoggerExpectedEndAt
      ? toValidDate(existing.dataLoggerExpectedEndAt)
      : loggerInstalledAt
        ? new Date(loggerInstalledAt.getTime() + nextDataLoggerDays * 24 * 60 * 60 * 1000)
        : null;
  const loggerCompletedAt = input.dataLoggerCompletedAt
    ? toValidDate(input.dataLoggerCompletedAt)
    : existing.dataLoggerCompletedAt
      ? toValidDate(existing.dataLoggerCompletedAt)
      : nextDataLoggerStatus === "COMPLETED"
        ? new Date()
        : null;
  const nextVisitFee = Number(input.visitFee ?? existing.visitFee);
  const nextCounty = input.county?.trim() || existing.county;
  const nextTown = input.town?.trim() || existing.town;
  const nextZone = getServiceZone(nextCounty, nextTown);
  if ((input.county !== undefined || input.town !== undefined) && !nextZone) {
    throw new Error("Select a recognized county and town before saving the Site Visit.");
  }
  const nextCreditStatus = deriveSiteVisitCreditStatus({
    paymentStatus: nextPaymentStatus,
    currentStatus: existing.quotationCreditStatus,
  });
  const paymentChanged = nextPaymentStatus !== existing.paymentStatus;

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
      "assignedStaffId" = ${nextAssignedStaffId},
      "assignedStaffName" = ${nextAssignedStaffId ? userLabels.assignedStaffName : null},
      "assignedTechnicianId" = ${nextAssignedTechnicianId},
      "assignedTechnicianName" = ${nextAssignedTechnicianId ? userLabels.assignedTechnicianName : null},
      "transportMethod" = ${input.transportMethod?.trim() || existing.transportMethod},
      "visitFee" = ${input.visitFee ?? existing.visitFee},
      "paymentStatus" = ${input.paymentStatus || existing.paymentStatus},
      "paymentReference" = ${input.paymentReference?.trim() || existing.paymentReference},
      "feeRegion" = ${nextZone?.id || existing.feeRegion},
      "serviceZone" = ${nextZone?.id || existing.serviceZone},
      "serviceZoneLabel" = ${nextZone?.name || existing.serviceZoneLabel},
      "locationCounty" = ${nextCounty || existing.locationCounty},
      "locationTown" = ${nextTown || existing.locationTown},
      "appliedFee" = ${input.visitFee ?? existing.appliedFee},
      "dataLoggerRequested" = ${nextDataLoggerRequested},
      "dataLoggerDays" = ${nextDataLoggerDays},
      "dataLoggerDailyRate" = ${DATA_LOGGER_DAILY_RATE},
      "dataLoggerFee" = ${nextDataLoggerFee},
      "dataLoggerStatus" = ${nextDataLoggerStatus},
      "dataLoggerInstalledAt" = ${loggerInstalledAt},
      "dataLoggerExpectedEndAt" = ${loggerExpectedEndAt},
      "dataLoggerCompletedAt" = ${loggerCompletedAt},
      "totalPayable" = ${nextVisitFee + nextDataLoggerFee},
      "standardVisitFee" = ${nextZone?.siteVisitFee ?? existing.standardVisitFee},
      "feeOverrideReason" = ${input.feeOverrideReason?.trim() || existing.feeOverrideReason},
      "paymentMethod" = ${input.paymentMethod?.trim() || existing.paymentMethod},
      "paymentAmount" = ${nextPaymentStatus === "PAID" ? Number(input.paymentAmount ?? existing.paymentAmount ?? nextVisitFee + nextDataLoggerFee) : existing.paymentAmount},
      "paymentPaidAt" = ${nextPaymentStatus === "PAID" ? (toValidDate(existing.paymentPaidAt) || new Date()) : null},
      "paymentRecordedById" = ${paymentChanged ? actor.id : existing.paymentRecordedById},
      "paymentRecordedByName" = ${paymentChanged ? actor.name ?? actor.email ?? "Betech Staff" : existing.paymentRecordedByName},
      "paymentVerificationStatus" = ${nextPaymentStatus === "PAID" ? "VERIFIED" : existing.paymentVerificationStatus},
      "waiverReason" = ${input.waiverReason?.trim() || existing.waiverReason},
      "waiverAuthorizedById" = ${nextPaymentStatus === "WAIVED" ? actor.id : existing.waiverAuthorizedById},
      "waiverAuthorizedByName" = ${nextPaymentStatus === "WAIVED" ? actor.name ?? actor.email ?? "Betech Staff" : existing.waiverAuthorizedByName},
      "quotationCreditStatus" = ${nextCreditStatus},
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

  let updated = updatedRows[0] ? serializeSiteVisit(updatedRows[0]) : null;
  if (!updated) return null;

  if (input.status && updated.status !== input.status) {
    const forcedRows = await prisma.$queryRaw<SiteVisitRow[]>(Prisma.sql`
      UPDATE "SiteVisit"
      SET
        "status" = ${input.status},
        "completedAt" = ${completedAt},
        "closedAt" = ${closedAt},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
      RETURNING ${SITE_VISIT_SELECT_SQL}
    `);
    updated = forcedRows[0] ? serializeSiteVisit(forcedRows[0]) : updated;
  }

  const changes: string[] = [];
  if (nextStatus !== existing.status) changes.push(`Status ${existing.status} → ${nextStatus}`);
  if (updated.scheduledAt !== existing.scheduledAt) changes.push(`Schedule ${updated.scheduledAt ? new Date(updated.scheduledAt).toLocaleString("en-KE") : "removed"}`);
  if (updated.assignedTechnicianId !== existing.assignedTechnicianId) changes.push(`Technician ${existing.assignedTechnicianName || "Unassigned"} → ${updated.assignedTechnicianName || "Unassigned"}`);
  if (updated.visitFee !== existing.visitFee) changes.push(`Visit fee KES ${existing.visitFee.toLocaleString("en-KE")} → KES ${updated.visitFee.toLocaleString("en-KE")}`);
  if (nextPaymentStatus !== existing.paymentStatus) changes.push(`Payment ${nextPaymentStatus}${updated.paymentReference ? ` · Ref ${updated.paymentReference}` : ""}`);
  if (nextOutcome !== existing.outcome && nextOutcome) changes.push(`Outcome ${nextOutcome.replace(/_/g, " ")}`);
  if (updated.assessmentSummary !== existing.assessmentSummary && updated.assessmentSummary) changes.push("Assessment submitted");
  if (!changes.length) changes.push("Visit information updated");

  await recordSiteVisitEvent({
    siteVisitId: updated.id,
    eventType: "SITE_VISIT_UPDATED",
    eventLabel: nextStatus !== existing.status ? `Status changed to ${nextStatus}` : "Site visit updated",
    eventDetail: changes.join(" · "),
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
  const take = Math.max(1, Math.min(100, Number(input.take ?? 5)));
  const rows = await prisma.$queryRaw<SiteVisitRow[]>(Prisma.sql`
    SELECT ${SITE_VISIT_SELECT_SQL}
    FROM "SiteVisit"
    WHERE (${Prisma.join(conditions, " OR ")})
    ORDER BY COALESCE("scheduledAt", "createdAt") DESC
    LIMIT ${take}
  `);
  return rows.map(serializeSiteVisit);
}

function isDataLoggerStatus(value: unknown): value is DataLoggerStatus {
  return DATA_LOGGER_STATUSES.includes(String(value).trim().toUpperCase() as DataLoggerStatus);
}

export function toCustomerSiteVisit(visit: SerializedSiteVisit) {
  return {
    id: visit.id,
    visitRef: visit.visitRef,
    quoteRef: visit.quoteRef,
    projectType: visit.projectType,
    visitReason: visit.visitReason,
    status: visit.status,
    preferredDate: visit.preferredDate,
    preferredTimeLabel: visit.preferredTimeLabel,
    scheduledAt: visit.scheduledAt,
    county: visit.county,
    town: visit.town,
    location: visit.location,
    mapUrl: visit.mapUrl,
    landmark: visit.landmark,
    assignedTechnicianName: visit.assignedTechnicianName,
    assignedStaffName: visit.assignedStaffName,
    visitFee: visit.visitFee,
    paymentStatus: visit.paymentStatus,
    paymentReference: visit.paymentReference,
    paymentVerificationStatus: visit.paymentVerificationStatus,
    serviceZone: visit.serviceZone,
    serviceZoneLabel: visit.serviceZoneLabel,
    originProductId: visit.originProductId,
    originProductName: visit.originProductName,
    originProductSlug: visit.originProductSlug,
    originProductPrice: visit.originProductPrice,
    originProductCategory: visit.originProductCategory,
    originProductImage: visit.originProductImage,
    originProductUrl: visit.originProductUrl,
    dataLoggerRequested: visit.dataLoggerRequested,
    dataLoggerDays: visit.dataLoggerDays,
    dataLoggerDailyRate: visit.dataLoggerDailyRate,
    dataLoggerFee: visit.dataLoggerFee,
    dataLoggerStatus: visit.dataLoggerStatus,
    totalPayable: visit.totalPayable,
    quotationCreditStatus: visit.quotationCreditStatus,
    outcome: visit.outcome,
    rescheduleRequestedAt: visit.rescheduleRequestedAt,
    rescheduleRequestedDate: visit.rescheduleRequestedDate,
    rescheduleRequestedTimeLabel: visit.rescheduleRequestedTimeLabel,
    cancellationRequestedAt: visit.cancellationRequestedAt,
    createdAt: visit.createdAt,
    updatedAt: visit.updatedAt,
  };
}

export async function customerOwnsSiteVisit(input: {
  visitId: string;
  userId: string;
  phoneVariants: string[];
  normalizedEmails: string[];
}) {
  const visit = await getSiteVisitById(input.visitId);
  if (!visit) return null;
  if (visit.customerUserId === input.userId) return visit;
  const phones = new Set(input.phoneVariants.map((value) => value.trim()).filter(Boolean));
  if (phones.has(visit.customerPhone.trim())) return visit;
  const emails = new Set(input.normalizedEmails.map((value) => value.trim().toLowerCase()).filter(Boolean));
  return visit.customerEmail && emails.has(visit.customerEmail.trim().toLowerCase()) ? visit : null;
}

export async function recordCustomerSiteVisitAction(
  visit: SerializedSiteVisit,
  input: z.infer<typeof customerSiteVisitActionSchema>,
  actor: { id: string; name: string | null; email: string | null },
) {
  await ensureSiteVisitsSchema();
  if (visit.status === "CLOSED") throw new Error("Closed site visits can no longer be changed.");

  if (input.action === "REQUEST_RESCHEDULE") {
    if (visit.status === "VISITED") throw new Error("A completed visit cannot be rescheduled.");
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "SiteVisit" SET
        "rescheduleRequestedAt" = CURRENT_TIMESTAMP,
        "rescheduleRequestedDate" = ${new Date(`${input.preferredDate}T00:00:00.000`)},
        "rescheduleRequestedTimeLabel" = ${input.preferredTimeLabel},
        "rescheduleReason" = ${input.reason?.trim() || null},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${visit.id}
    `);
    await recordSiteVisitEvent({
      siteVisitId: visit.id,
      eventType: "CUSTOMER_RESCHEDULE_REQUESTED",
      eventLabel: "Customer requested reschedule",
      eventDetail: `${input.preferredDate} · ${input.preferredTimeLabel}${input.reason ? ` · ${input.reason}` : ""}`,
      actorUserId: actor.id,
      actorName: actor.name ?? actor.email ?? "Customer",
    });
  } else if (input.action === "UPDATE_LOCATION") {
    if (visit.status === "VISITED") throw new Error("Location cannot be changed after the visit is completed.");
    const zone = getServiceZone(input.county, input.town);
    if (!zone) throw new Error("Select a recognized county and town before updating the location.");
    const fee = zone.siteVisitFee;
    const canReprice = visit.paymentStatus === "UNPAID" || visit.paymentStatus === "COLLECT_ON_SITE";
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "SiteVisit" SET "county" = ${input.county}, "town" = ${input.town}, "location" = ${input.location},
        "landmark" = ${input.landmark?.trim() || null}, "mapUrl" = ${input.mapUrl?.trim() || null},
        "feeRegion" = ${zone.id}, "serviceZone" = ${zone.id}, "serviceZoneLabel" = ${zone.name},
        "locationCounty" = ${input.county}, "locationTown" = ${input.town}, "standardVisitFee" = ${fee},
        "visitFee" = ${canReprice ? fee : visit.visitFee},
        "appliedFee" = ${canReprice ? fee : visit.appliedFee},
        "totalPayable" = ${(canReprice ? fee : visit.visitFee) + visit.dataLoggerFee},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${visit.id}
    `);
    await recordSiteVisitEvent({ siteVisitId: visit.id, eventType: "CUSTOMER_LOCATION_UPDATED", eventLabel: "Customer updated location", eventDetail: `${input.location}, ${input.town}, ${input.county}`, actorUserId: actor.id, actorName: actor.name ?? actor.email ?? "Customer" });
  } else if (input.action === "REQUEST_CANCELLATION") {
    await prisma.$executeRaw(Prisma.sql`UPDATE "SiteVisit" SET "cancellationRequestedAt" = CURRENT_TIMESTAMP, "cancellationReason" = ${input.reason}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${visit.id}`);
    await recordSiteVisitEvent({ siteVisitId: visit.id, eventType: "CUSTOMER_CANCELLATION_REQUESTED", eventLabel: "Customer requested cancellation", eventDetail: input.reason, actorUserId: actor.id, actorName: actor.name ?? actor.email ?? "Customer" });
  } else {
    if (visit.paymentStatus === "PAID") throw new Error("This site visit fee is already paid.");
    const paymentReference = input.paymentMethod.trim().toUpperCase() === "MPESA"
      ? extractMpesaTransactionCode(input.paymentReference)
      : input.paymentReference.trim().toUpperCase();
    if (!paymentReference) throw new Error("Enter a valid 10-character M-Pesa transaction code.");
    const duplicate = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "SiteVisit"
      WHERE UPPER(COALESCE("paymentReference", '')) = ${paymentReference}
        AND "id" <> ${visit.id}
      LIMIT 1
    `);
    if (duplicate.length) throw new Error("This payment reference has already been used for another booking.");
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "SiteVisit" SET "paymentMethod" = ${input.paymentMethod}, "paymentReference" = ${paymentReference},
        "paymentAmount" = ${visit.totalPayable}, "paymentSubmittedAt" = CURRENT_TIMESTAMP,
        "paymentVerificationStatus" = 'PENDING', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${visit.id}
    `);
    await recordSiteVisitEvent({ siteVisitId: visit.id, eventType: "PAYMENT_SUBMITTED", eventLabel: "Payment submitted for verification", eventDetail: `${input.paymentMethod} · KES ${visit.totalPayable.toLocaleString("en-KE")} · Ref ${paymentReference}`, actorUserId: actor.id, actorName: actor.name ?? actor.email ?? "Customer" });
  }
  return getSiteVisitById(visit.id);
}

export async function createQuotationDraftFromSiteVisit(
  visit: SerializedSiteVisit,
  actor: { id: string; name: string | null; email: string | null },
) {
  if (visit.quoteRequestId) return getQuoteRequestByRef(visit.quoteRef || "");
  if (visit.status !== "VISITED" && visit.status !== "CLOSED") {
    throw new Error("Complete the site visit assessment before creating a quotation draft.");
  }
  const quote = await createQuoteRequest({
    name: visit.customerName,
    phone: visit.customerPhone,
    email: visit.customerEmail || undefined,
    customerUserId: visit.customerUserId || undefined,
    location: [visit.location, visit.town, visit.county].filter(Boolean).join(", "),
    county: visit.county || undefined,
    town: visit.town || undefined,
    specificLocation: visit.location || undefined,
    projectType: visit.projectType || "OTHER",
    propertyType: visit.propertyType || undefined,
    load: visit.appliancesToInspect || undefined,
    preferredProducts: visit.recommendedItems || visit.recommendedSystem || undefined,
    notes: [
      `Site visit: ${visit.visitRef}`,
      visit.customerRequirements ? `Customer requirements: ${visit.customerRequirements}` : null,
      visit.assessmentSummary ? `Assessment: ${visit.assessmentSummary}` : null,
      visit.recommendedSystem ? `Recommended system: ${visit.recommendedSystem}` : null,
    ].filter(Boolean).join("\n"),
    status: "PENDING",
    source: "MANUAL",
    fallbackAssigneeId: visit.assignedStaffId || actor.id,
    metadata: { sourceLabel: "SITE_VISIT", siteVisitId: visit.id, siteVisitRef: visit.visitRef, siteVisitCreditAvailable: visit.quotationCreditStatus === "AVAILABLE" ? visit.visitFee : 0 },
  });
  if (!quote) throw new Error("Unable to create quotation draft.");
  await prisma.$executeRaw(Prisma.sql`UPDATE "SiteVisit" SET "quoteRequestId" = ${quote.id}, "quoteRef" = ${quote.quoteRef}, "outcome" = 'QUOTATION_CREATED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${visit.id}`);
  await recordSiteVisitEvent({ siteVisitId: visit.id, eventType: "QUOTATION_DRAFT_CREATED", eventLabel: "Quotation draft created", eventDetail: quote.quoteRef, actorUserId: actor.id, actorName: actor.name ?? actor.email ?? "Betech Staff", metadata: { quoteRequestId: quote.id, quoteRef: quote.quoteRef } });
  await recordQuotationEvent({ quoteRequestId: quote.id, eventType: "SITE_VISIT_LINKED", eventLabel: "Site visit assessment linked", eventDetail: visit.visitRef, actorUserId: actor.id, actorName: actor.name ?? actor.email ?? "Betech Staff", metadata: { siteVisitId: visit.id, siteVisitRef: visit.visitRef } });
  return quote;
}

export async function applySiteVisitCredit(
  visit: SerializedSiteVisit,
  actor: { id: string; name: string | null; email: string | null },
) {
  if (visit.paymentStatus !== "PAID" || visit.quotationCreditStatus !== "AVAILABLE") throw new Error("This visit has no available paid credit.");
  if (!visit.quoteRequestId || !visit.quoteRef) throw new Error("Create and link a quotation before applying the credit.");
  const quote = await getQuoteRequestByRef(visit.quoteRef);
  if (!quote || !["APPROVED", "CONVERTED"].includes(quote.status)) throw new Error("Credit can only be applied after the quotation is approved or converted.");
  const quotationData = quote.quotationData && typeof quote.quotationData === "object" ? quote.quotationData as Record<string, unknown> : {};
  const currentTotal = Number(quotationData.total || 0);
  const amount = Math.min(visit.paymentAmount || visit.visitFee, currentTotal || visit.visitFee);
  const nextData = { ...quotationData, siteVisitCredit: { visitId: visit.id, visitRef: visit.visitRef, amount, label: "Less: Site Visit Fee Already Paid" }, totalBeforeSiteVisitCredit: currentTotal, total: Math.max(0, currentTotal - amount), balanceAmount: Math.max(0, Number(quotationData.balanceAmount ?? currentTotal) - amount) };
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.$executeRaw(Prisma.sql`UPDATE "SiteVisit" SET "quotationCreditStatus" = 'APPLIED', "creditedQuotationId" = ${quote.id}, "creditedQuotationRef" = ${quote.quoteRef}, "creditedAmount" = ${amount}, "creditedAt" = CURRENT_TIMESTAMP, "creditAppliedById" = ${actor.id}, "creditAppliedByName" = ${actor.name ?? actor.email ?? "Betech Staff"}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${visit.id} AND "quotationCreditStatus" = 'AVAILABLE'`);
    if (claimed !== 1) throw new Error("This Site Visit credit has already been used.");
    await tx.$executeRaw(Prisma.sql`UPDATE "QuoteRequest" SET "quotationData" = ${nextData as Prisma.JsonObject}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${quote.id}`);
  });
  await recordSiteVisitEvent({ siteVisitId: visit.id, eventType: "SITE_VISIT_CREDIT_APPLIED", eventLabel: "Site Visit credit applied", eventDetail: `KES ${amount.toLocaleString("en-KE")} applied to ${quote.quoteRef}`, actorUserId: actor.id, actorName: actor.name ?? actor.email ?? "Betech Staff" });
  await recordQuotationEvent({ quoteRequestId: quote.id, eventType: "SITE_VISIT_CREDIT_APPLIED", eventLabel: "Site Visit Fee Credit applied", eventDetail: `Less: Site Visit Fee Already Paid · KES ${amount.toLocaleString("en-KE")}`, actorUserId: actor.id, actorName: actor.name ?? actor.email ?? "Betech Staff", metadata: { siteVisitId: visit.id, amount } });
  return getSiteVisitById(visit.id);
}
