import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";
import {
  getQuoteRequestStatusAliases,
  normalizeQuoteRequestStatus,
  QUOTE_REQUEST_ACTIONABLE_STATUSES,
  QUOTE_REQUEST_STATUSES,
  type QuoteRequestStatus,
} from "@/lib/quoteRequestStatus";
import {
  QUOTE_FEE_MODES,
  quoteLineItemSchema,
  quotePaymentMethodSchema,
  quotePaymentTermsSchema,
  QUOTE_PROPOSAL_VISIBILITY_KEYS,
  QUOTE_WARRANTY_MODES,
  sanitizeQuoteLineItems,
  calculateQuoteTotal,
  normalizeQuotePaymentBreakdown,
  roundCurrency,
  type QuotePaymentMethod,
  type QuotePaymentTerms,
  type QuoteWarrantyMode,
} from "@/lib/quoteProposal";
import { applyQuotationAiEnrichment } from "@/lib/quotationAiSections";
export {
  getQuoteRequestStatusAliases,
  normalizeQuoteRequestStatus,
  QUOTE_REQUEST_ACTIONABLE_STATUSES,
  QUOTE_REQUEST_STATUSES,
} from "@/lib/quoteRequestStatus";
export type { QuoteRequestStatus } from "@/lib/quoteRequestStatus";

const quoteProposalVisibilitySchema = z.object({
  projectOverview: z.boolean().optional(),
  whatPriceIncludes: z.boolean().optional(),
  whatItCanPower: z.boolean().optional(),
  deliveryAndInstallation: z.boolean().optional(),
  warranty: z.boolean().optional(),
  afterSalesSupport: z.boolean().optional(),
  scopeExclusions: z.boolean().optional(),
  importantNotes: z.boolean().optional(),
  similarProjects: z.boolean().optional(),
  termsAndConditions: z.boolean().optional(),
});

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
    "status" TEXT NOT NULL DEFAULT 'PENDING',
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
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'WEBSITE_REQUEST'`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "templateId" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "templateName" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3)`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "approvedById" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "approvedByName" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "submittedForApprovalAt" TIMESTAMP(3)`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "submittedForApprovalById" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "versionNumber" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "parentQuoteRequestId" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "validUntil" TIMESTAMP(3)`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3)`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "customerActionAt" TIMESTAMP(3)`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "manualCustomerName" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "manualCustomerPhone" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "manualCustomerEmail" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "approvalReason" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "quotationDate" TIMESTAMP(3)`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "quotationLink" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "quotationPdfLink" TEXT`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "followUpSent" BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "followUpScheduledAt" TIMESTAMP(3)`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "followUpSentAt" TIMESTAMP(3)`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "secondFollowUpScheduledAt" TIMESTAMP(3)`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "secondFollowUpSentAt" TIMESTAMP(3)`,
  `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "followUpCancelledAt" TIMESTAMP(3)`,
  `ALTER TABLE "QuoteRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
  `UPDATE "QuoteRequest" SET "status" = 'PENDING' WHERE "status" IN ('NEW', 'PENDING_APPROVAL', 'DRAFT', 'CONTACTED', 'VIEWED')`,
  `UPDATE "QuoteRequest" SET "status" = 'QUOTED' WHERE "status" = 'SENT'`,
  `UPDATE "QuoteRequest" SET "status" = 'APPROVED' WHERE "status" = 'ACCEPTED'`,
  `UPDATE "QuoteRequest" SET "status" = 'FOLLOW_UP' WHERE "status" = 'AMOUNT_PENDING'`,
  `UPDATE "QuoteRequest" SET "status" = 'CLOSED' WHERE "status" IN ('REJECTED', 'EXPIRED')`,
  `CREATE INDEX IF NOT EXISTS "QuoteRequest_source_createdAt_idx" ON "QuoteRequest"("source","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "QuoteRequest_templateId_createdAt_idx" ON "QuoteRequest"("templateId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "QuoteRequest_followUpScheduledAt_idx" ON "QuoteRequest"("followUpScheduledAt")`,
  `CREATE INDEX IF NOT EXISTS "QuoteRequest_secondFollowUpScheduledAt_idx" ON "QuoteRequest"("secondFollowUpScheduledAt")`,
  `CREATE TABLE IF NOT EXISTS "QuotationTemplate" (
    "id" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "category" TEXT,
    "ownerAttendantId" TEXT,
    "ownerAttendantEmail" TEXT,
    "ownerAttendantName" TEXT,
    "systemSize" TEXT,
    "brand" TEXT,
    "projectOverview" TEXT,
    "whatItCanPower" TEXT,
    "scopeOfWork" TEXT,
    "deliveryTimeline" TEXT,
    "installationTimeline" TEXT,
    "warranty" TEXT,
    "afterSalesSupport" TEXT,
    "terms" TEXT,
    "internalNotes" TEXT,
    "defaultPaymentMethod" TEXT,
    "defaultPaymentTerms" TEXT,
    "defaultDepositAmount" DOUBLE PRECISION,
    "defaultBalanceAmount" DOUBLE PRECISION,
    "defaultPdfLayout" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "templateData" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationTemplate_pkey" PRIMARY KEY ("id")
  )`,
  `ALTER TABLE "QuotationTemplate" ADD COLUMN IF NOT EXISTS "ownerAttendantId" TEXT`,
  `ALTER TABLE "QuotationTemplate" ADD COLUMN IF NOT EXISTS "ownerAttendantEmail" TEXT`,
  `ALTER TABLE "QuotationTemplate" ADD COLUMN IF NOT EXISTS "ownerAttendantName" TEXT`,
  `CREATE INDEX IF NOT EXISTS "QuotationTemplate_isActive_updatedAt_idx" ON "QuotationTemplate"("isActive","updatedAt")`,
  `CREATE INDEX IF NOT EXISTS "QuotationTemplate_ownerAttendantId_updatedAt_idx" ON "QuotationTemplate"("ownerAttendantId","updatedAt")`,
  `CREATE TABLE IF NOT EXISTS "QuotationEvent" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventLabel" TEXT NOT NULL,
    "eventDetail" TEXT,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "QuotationEvent_quoteRequestId_createdAt_idx" ON "QuotationEvent"("quoteRequestId","createdAt")`,
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
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuoteRequest_approvedById_fkey'
        AND table_name = 'QuoteRequest'
    ) THEN
      ALTER TABLE "QuoteRequest"
        ADD CONSTRAINT "QuoteRequest_approvedById_fkey"
        FOREIGN KEY ("approvedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuoteRequest_parentQuoteRequestId_fkey'
        AND table_name = 'QuoteRequest'
    ) THEN
      ALTER TABLE "QuoteRequest"
        ADD CONSTRAINT "QuoteRequest_parentQuoteRequestId_fkey"
        FOREIGN KEY ("parentQuoteRequestId") REFERENCES "QuoteRequest"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuoteRequest_templateId_fkey'
        AND table_name = 'QuoteRequest'
    ) THEN
      ALTER TABLE "QuoteRequest"
        ADD CONSTRAINT "QuoteRequest_templateId_fkey"
        FOREIGN KEY ("templateId") REFERENCES "QuotationTemplate"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'QuotationEvent_quoteRequestId_fkey'
        AND table_name = 'QuotationEvent'
    ) THEN
      ALTER TABLE "QuotationEvent"
        ADD CONSTRAINT "QuotationEvent_quoteRequestId_fkey"
        FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
] as const;

const QUOTE_REQUEST_STAFF_EMAILS = ["jeniffer@betech.co.ke", "brendah@betech.co.ke"] as const;

const globalQuoteRequestState = globalThis as typeof globalThis & {
  __quoteRequestSchemaReady?: Promise<void>;
};

export const QUOTE_REQUEST_SOURCES = [
  "WEBSITE_REQUEST",
  "MANUAL",
  "RECEIPTS",
  "ADMIN",
  "WHATSAPP",
  "PHONE",
  "TEMPLATE",
] as const;

export type QuoteRequestSource = (typeof QUOTE_REQUEST_SOURCES)[number];

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

export const QUOTE_TEMPLATE_CATEGORIES = [
  "SOLAR_SYSTEM",
  "SOLAR_WATER_PUMP",
  "SOLAR_WATER_HEATER",
  "BOREHOLE",
  "RO_WATER_PURIFIER",
  "COMMERCIAL",
  "OTHER",
] as const;

export type QuoteTemplateCategory = (typeof QUOTE_TEMPLATE_CATEGORIES)[number];

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
  status?: QuoteRequestStatus;
  source?: QuoteRequestSource;
  assignedAttendantId?: string | null;
  assignedAttendantEmail?: string | null;
  assignedAttendantName?: string | null;
  templateId?: string | null;
  templateName?: string | null;
  requiresApproval?: boolean;
  manualCustomerName?: string | null;
  manualCustomerPhone?: string | null;
  manualCustomerEmail?: string | null;
  quoteTitle?: string | null;
  quoteMessage?: string | null;
  quotationData?: Record<string, Prisma.JsonValue> | null;
  responseMetadata?: Record<string, Prisma.JsonValue> | null;
  metadata?: Record<string, Prisma.JsonValue> | null;
};

export const quoteRequestResponseSchema = z.object({
  status: z.enum(QUOTE_REQUEST_STATUSES),
  quoteTitle: z.string().trim().max(200).optional(),
  quoteMessage: z.string().trim().max(12000).optional(),
  quoteItems: z.array(quoteLineItemSchema).default([]),
  discountAmount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z.number().nonnegative().max(1000000000).optional(),
  ),
  warrantyMode: z.enum(QUOTE_WARRANTY_MODES).optional(),
  fullSystemWarranty: z.string().trim().max(4000).optional(),
  customWarranty: z.string().trim().max(4000).optional(),
  warrantyGeneralNotes: z.string().trim().max(4000).optional(),
  aiWarrantySummary: z.string().trim().max(4000).optional(),
  projectOverview: z.string().trim().max(12000).optional(),
  whatPriceIncludes: z.string().trim().max(12000).optional(),
  whatItCanPower: z.string().trim().max(12000).optional(),
  deliveryTimeline: z.string().trim().max(4000).optional(),
  installationTimeline: z.string().trim().max(4000).optional(),
  afterSalesSupport: z.string().trim().max(8000).optional(),
  importantNotes: z.string().trim().max(8000).optional(),
  scopeExclusions: z.string().trim().max(8000).optional(),
  similarProjects: z.string().trim().max(8000).optional(),
  termsAndConditions: z.string().trim().max(12000).optional(),
  preparedByDetails: z.string().trim().max(4000).optional(),
  companyLegalDetails: z.string().trim().max(8000).optional(),
  projectReferenceLinks: z.string().trim().max(4000).optional(),
  proposalVisibility: quoteProposalVisibilitySchema.optional(),
  paymentMethod: quotePaymentMethodSchema.optional(),
  paymentTerms: quotePaymentTermsSchema.optional(),
  deliveryMode: z.enum(QUOTE_FEE_MODES).optional(),
  installationMode: z.enum(QUOTE_FEE_MODES).optional(),
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

export const bulkQuoteRequestUpdateSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(200),
  status: z.enum(QUOTE_REQUEST_STATUSES).optional(),
  assignedAttendantId: z.string().trim().nullable().optional(),
});

export type BulkQuoteRequestUpdateInput = z.infer<typeof bulkQuoteRequestUpdateSchema>;

export const quotationTemplateSchema = z.object({
  templateName: z.string().trim().min(2).max(200),
  category: z.enum(QUOTE_TEMPLATE_CATEGORIES).optional().or(z.literal("")),
  ownerAttendantId: z.string().trim().optional(),
  systemSize: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(120).optional(),
  projectReferenceLinks: z.string().trim().max(4000).optional(),
  projectOverview: z.string().trim().max(12000).optional(),
  whatItCanPower: z.string().trim().max(12000).optional(),
  scopeOfWork: z.string().trim().max(12000).optional(),
  deliveryTimeline: z.string().trim().max(500).optional(),
  installationTimeline: z.string().trim().max(500).optional(),
  warranty: z.string().trim().max(4000).optional(),
  afterSalesSupport: z.string().trim().max(4000).optional(),
  terms: z.string().trim().max(8000).optional(),
  internalNotes: z.string().trim().max(8000).optional(),
  defaultPaymentMethod: quotePaymentMethodSchema.optional(),
  defaultPaymentTerms: quotePaymentTermsSchema.optional(),
  defaultDepositAmount: z.number().nonnegative().optional(),
  defaultBalanceAmount: z.number().nonnegative().optional(),
  defaultDiscountAmount: z.number().nonnegative().optional(),
  defaultPdfLayout: z.string().trim().max(120).optional(),
  isActive: z.boolean().optional(),
  items: z.array(quoteLineItemSchema).default([]),
});

export type QuotationTemplateInput = z.infer<typeof quotationTemplateSchema>;

const optionalEnumValue = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.enum(values).optional(),
  );

export const manualQuotationCreateSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().min(7),
  email: z.string().trim().email().optional().or(z.literal("")),
  location: z.string().trim().optional(),
  county: z.string().trim().optional(),
  town: z.string().trim().optional(),
  specificLocation: z.string().trim().optional(),
  projectType: optionalEnumValue(QUOTE_PROJECT_TYPES).default("SOLAR_HOME_SYSTEM"),
  propertyType: z.string().trim().optional(),
  preferredContactMethod: optionalEnumValue(QUOTE_CONTACT_METHODS),
  bestTimeToContact: optionalEnumValue(QUOTE_CONTACT_TIMES),
  urgency: optionalEnumValue(QUOTE_URGENCY_LEVELS),
  installationStatus: optionalEnumValue(QUOTE_INSTALLATION_STATUSES),
  load: z.string().trim().optional(),
  budgetRange: z.string().trim().optional(),
  preferredProducts: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  answers: quoteStructuredAnswersSchema.optional(),
  status: z.enum(QUOTE_REQUEST_STATUSES).optional(),
  source: z.enum(QUOTE_REQUEST_SOURCES).optional(),
  assignedAttendantId: z.string().trim().optional(),
  templateId: z.string().trim().optional(),
  templateName: z.string().trim().optional(),
  quoteTitle: z.string().trim().max(200).optional(),
  quoteMessage: z.string().trim().max(12000).optional(),
  quoteItems: z.array(quoteLineItemSchema).default([]),
  discountAmount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z.number().nonnegative().max(1000000000).optional(),
  ),
  warrantyMode: z.enum(QUOTE_WARRANTY_MODES).optional(),
  fullSystemWarranty: z.string().trim().max(4000).optional(),
  customWarranty: z.string().trim().max(4000).optional(),
  warrantyGeneralNotes: z.string().trim().max(4000).optional(),
  aiWarrantySummary: z.string().trim().max(4000).optional(),
  projectOverview: z.string().trim().max(12000).optional(),
  whatPriceIncludes: z.string().trim().max(12000).optional(),
  whatItCanPower: z.string().trim().max(12000).optional(),
  deliveryTimeline: z.string().trim().max(4000).optional(),
  installationTimeline: z.string().trim().max(4000).optional(),
  afterSalesSupport: z.string().trim().max(8000).optional(),
  importantNotes: z.string().trim().max(8000).optional(),
  scopeExclusions: z.string().trim().max(8000).optional(),
  similarProjects: z.string().trim().max(8000).optional(),
  termsAndConditions: z.string().trim().max(12000).optional(),
  preparedByDetails: z.string().trim().max(4000).optional(),
  companyLegalDetails: z.string().trim().max(8000).optional(),
  projectReferenceLinks: z.string().trim().max(4000).optional(),
  proposalVisibility: quoteProposalVisibilitySchema.optional(),
  paymentMethod: quotePaymentMethodSchema.optional(),
  paymentTerms: quotePaymentTermsSchema.optional(),
  deliveryMode: z.enum(QUOTE_FEE_MODES).optional(),
  installationMode: z.enum(QUOTE_FEE_MODES).optional(),
  depositAmount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z.number().nonnegative().max(1000000000).optional(),
  ),
  balanceAmount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z.number().nonnegative().max(1000000000).optional(),
  ),
  followUpNotes: z.string().trim().max(4000).optional(),
});

export type ManualQuotationCreateInput = z.infer<typeof manualQuotationCreateSchema>;

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
  source: string | null;
  assignedAttendantId: string | null;
  assignedAttendantEmail: string | null;
  assignedAttendantName: string | null;
  templateId: string | null;
  templateName: string | null;
  requiresApproval: boolean | null;
  approvedAt: Date | string | null;
  approvedById: string | null;
  approvedByName: string | null;
  submittedForApprovalAt: Date | string | null;
  submittedForApprovalById: string | null;
  versionNumber: number | null;
  parentQuoteRequestId: string | null;
  validUntil: Date | string | null;
  viewedAt: Date | string | null;
  customerActionAt: Date | string | null;
  manualCustomerName: string | null;
  manualCustomerPhone: string | null;
  manualCustomerEmail: string | null;
  approvalReason: string | null;
  quotationDate: Date | string | null;
  quotationLink: string | null;
  quotationPdfLink: string | null;
  followUpSent: boolean | null;
  followUpScheduledAt: Date | string | null;
  followUpSentAt: Date | string | null;
  secondFollowUpScheduledAt: Date | string | null;
  secondFollowUpSentAt: Date | string | null;
  followUpCancelledAt: Date | string | null;
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

export const QUOTE_REQUEST_SELECT_SQL = Prisma.sql`
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
  "source",
  "assignedAttendantId",
  "assignedAttendantEmail",
  "assignedAttendantName",
  "templateId",
  "templateName",
  "requiresApproval",
  "approvedAt",
  "approvedById",
  "approvedByName",
  "submittedForApprovalAt",
  "submittedForApprovalById",
  "versionNumber",
  "parentQuoteRequestId",
  "validUntil",
  "viewedAt",
  "customerActionAt",
  "manualCustomerName",
  "manualCustomerPhone",
  "manualCustomerEmail",
  "approvalReason",
  "quotationDate",
  "quotationLink",
  "quotationPdfLink",
  "followUpSent",
  "followUpScheduledAt",
  "followUpSentAt",
  "secondFollowUpScheduledAt",
  "secondFollowUpSentAt",
  "followUpCancelledAt",
  "quoteTitle",
  "quoteMessage",
  "quotationData",
  "responseMetadata",
  "respondedAt",
  "respondedById",
  "metadata",
  "createdAt",
  "updatedAt"
`;

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
  source: QuoteRequestSource;
  assignedAttendant: {
    id: string | null;
    email: string | null;
    name: string | null;
  } | null;
  templateId: string | null;
  templateName: string | null;
  requiresApproval: boolean;
  approvedAt: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  submittedForApprovalAt: string | null;
  submittedForApprovalById: string | null;
  versionNumber: number;
  parentQuoteRequestId: string | null;
  validUntil: string | null;
  viewedAt: string | null;
  customerActionAt: string | null;
  manualCustomerName: string | null;
  manualCustomerPhone: string | null;
  manualCustomerEmail: string | null;
  approvalReason: string | null;
  quotationDate: string | null;
  quotationLink: string | null;
  quotationPdfLink: string | null;
  followUpSent: boolean;
  followUpScheduledAt: string | null;
  followUpSentAt: string | null;
  secondFollowUpScheduledAt: string | null;
  secondFollowUpSentAt: string | null;
  followUpCancelledAt: string | null;
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

export type SerializedQuotationTemplate = {
  id: string;
  templateName: string;
  category: QuoteTemplateCategory | null;
  ownerAttendantId: string | null;
  ownerAttendantEmail: string | null;
  ownerAttendantName: string | null;
  systemSize: string | null;
  brand: string | null;
  projectReferenceLinks: string | null;
  projectOverview: string | null;
  whatItCanPower: string | null;
  scopeOfWork: string | null;
  deliveryTimeline: string | null;
  installationTimeline: string | null;
  warranty: string | null;
  afterSalesSupport: string | null;
  terms: string | null;
  internalNotes: string | null;
  defaultPaymentMethod: QuotePaymentMethod | null;
  defaultPaymentTerms: QuotePaymentTerms | null;
  defaultDepositAmount: number | null;
  defaultBalanceAmount: number | null;
  defaultDiscountAmount: number | null;
  defaultPdfLayout: string | null;
  isActive: boolean;
  items: Array<z.infer<typeof quoteLineItemSchema>>;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedQuotationEvent = {
  id: string;
  quoteRequestId: string;
  eventType: string;
  eventLabel: string;
  eventDetail: string | null;
  actorUserId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
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

function isQuoteSource(value: unknown): value is QuoteRequestSource {
  return QUOTE_REQUEST_SOURCES.includes(String(value).trim().toUpperCase() as QuoteRequestSource);
}

function isQuoteTemplateCategory(value: unknown): value is QuoteTemplateCategory {
  return QUOTE_TEMPLATE_CATEGORIES.includes(
    String(value).trim().toUpperCase() as QuoteTemplateCategory,
  );
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

type QuotationTemplateRow = {
  id: string;
  templateName: string;
  category: string | null;
  ownerAttendantId: string | null;
  ownerAttendantEmail: string | null;
  ownerAttendantName: string | null;
  systemSize: string | null;
  brand: string | null;
  projectOverview: string | null;
  whatItCanPower: string | null;
  scopeOfWork: string | null;
  deliveryTimeline: string | null;
  installationTimeline: string | null;
  warranty: string | null;
  afterSalesSupport: string | null;
  terms: string | null;
  internalNotes: string | null;
  defaultPaymentMethod: string | null;
  defaultPaymentTerms: string | null;
  defaultDepositAmount: number | null;
  defaultBalanceAmount: number | null;
  defaultPdfLayout: string | null;
  isActive: boolean;
  templateData: Prisma.JsonValue | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export const QUOTATION_TEMPLATE_SELECT_SQL = Prisma.sql`
  "id",
  "templateName",
  "category",
  "ownerAttendantId",
  "ownerAttendantEmail",
  "ownerAttendantName",
  "systemSize",
  "brand",
  "projectOverview",
  "whatItCanPower",
  "scopeOfWork",
  "deliveryTimeline",
  "installationTimeline",
  "warranty",
  "afterSalesSupport",
  "terms",
  "internalNotes",
  "defaultPaymentMethod",
  "defaultPaymentTerms",
  "defaultDepositAmount",
  "defaultBalanceAmount",
  "defaultPdfLayout",
  "isActive",
  "templateData",
  "createdById",
  "updatedById",
  "createdAt",
  "updatedAt"
`;

type QuotationEventRow = {
  id: string;
  quoteRequestId: string;
  eventType: string;
  eventLabel: string;
  eventDetail: string | null;
  actorUserId: string | null;
  actorName: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date | string;
};

export const QUOTATION_EVENT_SELECT_SQL = Prisma.sql`
  "id",
  "quoteRequestId",
  "eventType",
  "eventLabel",
  "eventDetail",
  "actorUserId",
  "actorName",
  "metadata",
  "createdAt"
`;

function serializeQuotationTemplate(row: QuotationTemplateRow): SerializedQuotationTemplate {
  const templateData = asJsonObject(row.templateData);
  const items = Array.isArray(templateData?.items)
    ? sanitizeQuoteLineItems(
        (templateData.items as Array<unknown>).reduce<Array<z.infer<typeof quoteLineItemSchema>>>(
          (accumulator, item) => {
            if (!item || typeof item !== "object") return accumulator;
            const record = item as Record<string, unknown>;
            accumulator.push({
              itemName: String(record.itemName ?? ""),
              description: typeof record.description === "string" ? String(record.description) : undefined,
              quantity: Number(record.quantity ?? 0),
              unitPrice: Number(record.unitPrice ?? 0),
              defaultWarranty:
                typeof record.defaultWarranty === "string" ? String(record.defaultWarranty) : undefined,
              warranty: typeof record.warranty === "string" ? String(record.warranty) : undefined,
              warrantyPeriod:
                typeof record.warrantyPeriod === "number" ? Number(record.warrantyPeriod) : undefined,
              warrantyUnit:
                typeof record.warrantyUnit === "string"
                  ? (String(record.warrantyUnit) as z.infer<typeof quoteLineItemSchema>["warrantyUnit"])
                  : undefined,
              warrantyNotes:
                typeof record.warrantyNotes === "string" ? String(record.warrantyNotes) : undefined,
              warrantySource:
                typeof record.warrantySource === "string"
                  ? (String(record.warrantySource) as z.infer<typeof quoteLineItemSchema>["warrantySource"])
                  : undefined,
            });
            return accumulator;
          },
          [],
        ),
      )
    : [];
  return {
    id: row.id,
    templateName: row.templateName,
    category: isQuoteTemplateCategory(row.category) ? row.category : null,
    ownerAttendantId: row.ownerAttendantId,
    ownerAttendantEmail: row.ownerAttendantEmail,
    ownerAttendantName: row.ownerAttendantName,
    systemSize: row.systemSize,
    brand: row.brand,
    projectReferenceLinks:
      typeof templateData?.projectReferenceLinks === "string"
        ? templateData.projectReferenceLinks
        : null,
    projectOverview: row.projectOverview,
    whatItCanPower: row.whatItCanPower,
    scopeOfWork: row.scopeOfWork,
    deliveryTimeline: row.deliveryTimeline,
    installationTimeline: row.installationTimeline,
    warranty: row.warranty,
    afterSalesSupport: row.afterSalesSupport,
    terms: row.terms,
    internalNotes: row.internalNotes,
    defaultPaymentMethod: row.defaultPaymentMethod as QuotePaymentMethod | null,
    defaultPaymentTerms: row.defaultPaymentTerms as QuotePaymentTerms | null,
    defaultDepositAmount: row.defaultDepositAmount ?? null,
    defaultBalanceAmount: row.defaultBalanceAmount ?? null,
    defaultDiscountAmount:
      typeof templateData?.defaultDiscountAmount === "number" &&
      Number.isFinite(templateData.defaultDiscountAmount)
        ? Number(templateData.defaultDiscountAmount)
        : null,
    defaultPdfLayout: row.defaultPdfLayout,
    isActive: Boolean(row.isActive),
    items,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdAt: toIsoString(row.createdAt) || new Date().toISOString(),
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

function serializeQuotationEvent(row: QuotationEventRow): SerializedQuotationEvent {
  return {
    id: row.id,
    quoteRequestId: row.quoteRequestId,
    eventType: row.eventType,
    eventLabel: row.eventLabel,
    eventDetail: row.eventDetail,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    metadata: asJsonObject(row.metadata),
    createdAt: toIsoString(row.createdAt) || new Date().toISOString(),
  };
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

function getQuotationApprovalPolicy(input: {
  total: number;
  paymentTerms?: string | null;
  hasCustomDiscount?: boolean;
}) {
  const total = Number(input.total || 0);
  const paymentTerms = String(input.paymentTerms || "").trim().toUpperCase();
  if (total > 500000) {
    return { requiresApproval: true, reason: "Quotation amount above KSh 500,000." };
  }
  if (total >= 100000 && total <= 500000) {
    return { requiresApproval: true, reason: "Quotation amount in monitored approval band." };
  }
  if (input.hasCustomDiscount) {
    return { requiresApproval: true, reason: "Custom discount requires approval." };
  }
  if (paymentTerms && !["FULL_PAYMENT", "DEPOSIT_AND_BALANCE"].includes(paymentTerms)) {
    return { requiresApproval: true, reason: "Custom payment term requires approval." };
  }
  return { requiresApproval: false, reason: null as string | null };
}

async function appendQuotationEvent(input: {
  quoteRequestId: string;
  eventType: string;
  eventLabel: string;
  eventDetail?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, Prisma.JsonValue> | null;
}) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "QuotationEvent" (
      "id",
      "quoteRequestId",
      "eventType",
      "eventLabel",
      "eventDetail",
      "actorUserId",
      "actorName",
      "metadata",
      "createdAt"
    ) VALUES (
      ${randomUUID()},
      ${input.quoteRequestId},
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

export async function recordQuotationEvent(input: {
  quoteRequestId: string;
  eventType: string;
  eventLabel: string;
  eventDetail?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, Prisma.JsonValue> | null;
}) {
  await appendQuotationEvent(input);
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

function canUseQuotationDesk(input: {
  email?: string | null;
  attendantCategory?: string | null;
  role?: string | null;
}) {
  if (input.role === "ADMIN" || input.role === "SUPERVISOR") return true;
  if (isTechnicalTeamCategory(input.attendantCategory)) return true;
  return isQuoteRequestsStaffEmail(input.email);
}

export async function requireQuoteRequestsStaffActor(options?: { impersonateId?: string | null }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const email = normalizeEmail((session?.user as { email?: string } | undefined)?.email);
  const attendantCategory = (session?.user as { attendantCategory?: string | null } | undefined)?.attendantCategory ?? null;

  if (!session || !userId) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const hasElevatedRole = role === "ADMIN" || role === "SUPERVISOR";
  if (hasElevatedRole && options?.impersonateId) {
    const targetUser = await prisma.user.findUnique({
      where: { id: options.impersonateId },
      select: { id: true, name: true, email: true, attendantCategory: true },
    });
    if (!targetUser || !canUseQuotationDesk({ email: targetUser.email, attendantCategory: targetUser.attendantCategory })) {
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

  if (!hasElevatedRole && !canUseQuotationDesk({ email, attendantCategory, role })) {
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

export async function getOrderedQuoteStaffUsers() {
  const staffUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: [...QUOTE_REQUEST_STAFF_EMAILS] } },
        { attendantCategory: "TECHNICAL_TEAM" },
      ],
      isActive: true,
    },
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true },
  });

  const preferredUsers = QUOTE_REQUEST_STAFF_EMAILS.map((value) =>
    staffUsers.find((user) => normalizeEmail(user.email) === value),
  ).filter((user): user is { id: string; name: string | null; email: string | null } => Boolean(user?.id));

  const preferredIds = new Set(preferredUsers.map((user) => user.id));
  const technicalUsers = staffUsers.filter((user) => !preferredIds.has(user.id));

  return [...preferredUsers, ...technicalUsers];
}

export async function getQuoteStaffUserById(userId: string | null | undefined) {
  if (!userId) return null;
  const staff = await getOrderedQuoteStaffUsers();
  return staff.find((user) => user.id === userId) ?? null;
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
  const normalizedStatus = normalizeQuoteRequestStatus(row.status);
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
    status: normalizedStatus,
    source: isQuoteSource(row.source) ? row.source : "WEBSITE_REQUEST",
    assignedAttendant: row.assignedAttendantId
      ? {
          id: row.assignedAttendantId,
          email: row.assignedAttendantEmail,
          name: row.assignedAttendantName,
        }
      : null,
    templateId: row.templateId,
    templateName: row.templateName,
    requiresApproval: Boolean(row.requiresApproval),
    approvedAt: toIsoString(row.approvedAt),
    approvedById: row.approvedById,
    approvedByName: row.approvedByName,
    submittedForApprovalAt: toIsoString(row.submittedForApprovalAt),
    submittedForApprovalById: row.submittedForApprovalById,
    versionNumber: Math.max(1, Number(row.versionNumber ?? 1)),
    parentQuoteRequestId: row.parentQuoteRequestId,
    validUntil: toIsoString(row.validUntil),
    viewedAt: toIsoString(row.viewedAt),
    customerActionAt: toIsoString(row.customerActionAt),
    manualCustomerName: row.manualCustomerName,
    manualCustomerPhone: row.manualCustomerPhone,
    manualCustomerEmail: row.manualCustomerEmail,
    approvalReason: row.approvalReason,
    quotationDate: toIsoString(row.quotationDate),
    quotationLink: row.quotationLink,
    quotationPdfLink: row.quotationPdfLink,
    followUpSent: Boolean(row.followUpSent),
    followUpScheduledAt: toIsoString(row.followUpScheduledAt),
    followUpSentAt: toIsoString(row.followUpSentAt),
    secondFollowUpScheduledAt: toIsoString(row.secondFollowUpScheduledAt),
    secondFollowUpSentAt: toIsoString(row.secondFollowUpSentAt),
    followUpCancelledAt: toIsoString(row.followUpCancelledAt),
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
  const requestedAssignee = await getQuoteStaffUserById(input.assignedAttendantId ?? null);
  const assignee = requestedAssignee || (await pickQuoteAssignee());
  const id = randomUUID();
  const quotationData = input.quotationData
    ? input.quotationData
    : input.quoteTitle || input.quoteMessage
      ? {
          items: [],
          subtotal: 0,
          total: 0,
          paymentMethod: null,
          paymentTerms: "FULL_PAYMENT",
          depositAmount: null,
          balanceAmount: null,
        }
      : null;
  const metadata = {
    source: input.source || "WEBSITE_REQUEST",
    assignedAt: new Date().toISOString(),
    ...(input.metadata || {}),
  } as Prisma.JsonObject;

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
      "source",
      "assignedAttendantId",
      "assignedAttendantEmail",
      "assignedAttendantName",
      "templateId",
      "templateName",
      "requiresApproval",
      "manualCustomerName",
      "manualCustomerPhone",
      "manualCustomerEmail",
      "quoteTitle",
      "quoteMessage",
      "quotationData",
      "responseMetadata",
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
      ${input.status || "PENDING"},
      ${input.source || "WEBSITE_REQUEST"},
      ${assignee?.id ?? null},
      ${assignee?.email ? normalizeEmail(assignee.email) : null},
      ${assignee?.name ?? assignee?.email ?? null},
      ${input.templateId ?? null},
      ${input.templateName ?? null},
      ${Boolean(input.requiresApproval)},
      ${input.manualCustomerName?.trim() || null},
      ${normalizePhone(input.manualCustomerPhone || "") || null},
      ${input.manualCustomerEmail?.trim() || null},
      ${input.quoteTitle?.trim() || null},
      ${input.quoteMessage?.trim() || null},
      ${(quotationData ?? null) as Prisma.JsonObject | null},
      ${(input.responseMetadata ?? null) as Prisma.JsonObject | null},
      ${metadata},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);

  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE "id" = ${id}
    LIMIT 1
  `);

  const created = rows[0] ? serializeQuoteRequest(rows[0]) : null;
  if (created) {
    await appendQuotationEvent({
      quoteRequestId: created.id,
      eventType: "CREATED",
      eventLabel:
        input.source && input.source !== "WEBSITE_REQUEST"
          ? "Quotation created manually"
          : "Customer quote request created",
      eventDetail:
        input.templateName
          ? `Template used: ${input.templateName}`
          : input.quoteTitle || input.preferredProducts || null,
      actorUserId: assignee?.id ?? null,
      actorName: assignee?.name ?? assignee?.email ?? null,
      metadata: {
        source: created.source,
        status: created.status,
      },
    });
  }

  return created;
}

function buildStatusWhere(status: QuoteRequestStatus | "ALL") {
  if (status === "ALL") return Prisma.empty;
  return Prisma.sql`AND UPPER(COALESCE("status", '')) IN (${Prisma.join(getQuoteRequestStatusAliases(status))})`;
}

export async function listAssignedQuoteRequests(input: {
  userId: string;
  status?: QuoteRequestStatus | "ALL";
  q?: string;
  source?: QuoteRequestSource | "ALL";
}) {
  await ensureQuoteRequestsSchema();
  const query = (input.q || "").trim();
  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE "assignedAttendantId" = ${input.userId}
      ${buildStatusWhere(input.status || "ALL")}
      ${
        input.source && input.source !== "ALL"
          ? Prisma.sql`AND "source" = ${input.source}`
          : Prisma.empty
      }
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
    ORDER BY "updatedAt" DESC, "createdAt" DESC
  `);

  return rows.map(serializeQuoteRequest);
}

export async function deleteQuoteRequest(
  id: string,
  actor: { userId: string; isElevatedActor?: boolean },
) {
  await ensureQuoteRequestsSchema();
  const existingRows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE "id" = ${id}
    LIMIT 1
  `);
  const existing = existingRows[0] ? serializeQuoteRequest(existingRows[0]) : null;
  if (!existing) return null;

  const assignedAttendantId = existing.assignedAttendant?.id ?? null;
  if (!actor.isElevatedActor && assignedAttendantId !== actor.userId) {
    throw new Error("You can only delete quotations assigned to you.");
  }

  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "QuoteRequest"
    WHERE "id" = ${id}
  `);

  return existing;
}

export async function getAssignedQuoteRequestById(id: string, userId: string) {
  await ensureQuoteRequestsSchema();
  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE "id" = ${id}
      AND "assignedAttendantId" = ${userId}
    LIMIT 1
  `);
  return rows[0] ? serializeQuoteRequest(rows[0]) : null;
}

export async function getQuoteRequestById(id: string) {
  await ensureQuoteRequestsSchema();
  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE "id" = ${id}
    LIMIT 1
  `);
  return rows[0] ? serializeQuoteRequest(rows[0]) : null;
}

export async function getQuoteRequestByRef(quoteRef: string) {
  await ensureQuoteRequestsSchema();
  const normalizedRef = String(quoteRef || "").trim();
  if (!normalizedRef) return null;

  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE "quoteRef" = ${normalizedRef}
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
  const discountAmount = roundCurrency(Math.max(0, Number(input.discountAmount || 0)));
  const discountedTotal = roundCurrency(Math.max(0, subtotal - discountAmount));
  const paymentBreakdown = normalizeQuotePaymentBreakdown({
    total: discountedTotal,
    paymentTerms: input.paymentTerms,
    depositAmount: input.depositAmount,
    balanceAmount: input.balanceAmount,
  });
  const existingRows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE "id" = ${id}
    LIMIT 1
  `);
  const existing = existingRows[0] ? serializeQuoteRequest(existingRows[0]) : null;
  if (!existing) return null;
  const enriched = applyQuotationAiEnrichment({
    projectType: existing.projectType,
    quoteTitle: input.quoteTitle,
    items: sanitizedItems,
    total: paymentBreakdown.total,
    paymentTerms: paymentBreakdown.paymentTerms,
    warrantyMode: (input.warrantyMode || "PER_ITEM") as QuoteWarrantyMode,
    fullSystemWarranty: input.fullSystemWarranty,
    customWarranty: input.customWarranty,
    quoteMessage: input.quoteMessage,
    customerNotes: input.followUpNotes,
    customerLocation: existing.customerLocation || [existing.town, existing.county].filter(Boolean).join(", "),
    projectOverview: input.projectOverview,
    whatPriceIncludes: input.whatPriceIncludes,
    whatItCanPower: input.whatItCanPower,
    deliveryTimeline: input.deliveryTimeline,
    installationTimeline: input.installationTimeline,
    afterSalesSupport: input.afterSalesSupport,
    importantNotes: input.importantNotes,
    scopeExclusions: input.scopeExclusions,
    aiWarrantySummary: input.aiWarrantySummary,
  });
  const quotationData = {
    items: sanitizedItems,
    subtotal,
    total: paymentBreakdown.total,
    discountAmount,
    warrantyMode: (input.warrantyMode || "PER_ITEM") as QuoteWarrantyMode,
    fullSystemWarranty: input.fullSystemWarranty?.trim() || null,
    customWarranty: input.customWarranty?.trim() || null,
    warrantyGeneralNotes: input.warrantyGeneralNotes?.trim() || null,
    aiWarrantySummary: enriched.aiWarrantySummary?.trim() || null,
    projectOverview: enriched.projectOverview?.trim() || null,
    whatPriceIncludes: enriched.whatPriceIncludes?.trim() || null,
    whatItCanPower: enriched.whatItCanPower?.trim() || null,
    deliveryTimeline: enriched.deliveryTimeline?.trim() || null,
    installationTimeline: enriched.installationTimeline?.trim() || null,
    afterSalesSupport: enriched.afterSalesSupport?.trim() || null,
    importantNotes: enriched.importantNotes?.trim() || null,
    scopeExclusions: enriched.scopeExclusions?.trim() || null,
    similarProjects: input.similarProjects?.trim() || null,
    termsAndConditions: input.termsAndConditions?.trim() || null,
    preparedByDetails: input.preparedByDetails?.trim() || null,
    companyLegalDetails: input.companyLegalDetails?.trim() || null,
    projectReferenceLinks: input.projectReferenceLinks?.trim() || null,
    aiGeneratedSections: enriched.generated,
    proposalVisibility: Object.fromEntries(
      QUOTE_PROPOSAL_VISIBILITY_KEYS.map((key) => [key, input.proposalVisibility?.[key] !== false]),
    ),
    paymentMethod: input.paymentMethod || null,
    paymentTerms: paymentBreakdown.paymentTerms,
    deliveryMode: input.deliveryMode || "INCLUDED",
    installationMode: input.installationMode || "INCLUDED",
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
  const nextStatus = input.status;

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "QuoteRequest"
    SET
      "status" = ${nextStatus},
      "quoteTitle" = ${input.quoteTitle?.trim() || null},
      "quoteMessage" = ${input.quoteMessage?.trim() || null},
      "quotationData" = ${quotationData as Prisma.JsonObject},
      "responseMetadata" = ${responseMetadata as Prisma.JsonObject},
      "requiresApproval" = false,
      "approvalReason" = null,
      "submittedForApprovalAt" = null,
      "submittedForApprovalById" = null,
      "approvedAt" = null,
      "approvedById" = null,
      "approvedByName" = null,
      "respondedAt" = CURRENT_TIMESTAMP,
      "respondedById" = ${user.id},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
  `);

  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE "id" = ${id}
    LIMIT 1
  `);

  const updated = rows[0] ? serializeQuoteRequest(rows[0]) : null;
  if (updated) {
    await appendQuotationEvent({
      quoteRequestId: updated.id,
      eventType: nextStatus,
      eventLabel:
        nextStatus === "QUOTED"
          ? "Quotation saved"
          : "Quotation updated",
      eventDetail: input.quoteTitle?.trim() || input.followUpNotes?.trim() || null,
      actorUserId: user.id,
      actorName: user.name ?? user.email ?? "Quotation attendant",
      metadata: {
        total: paymentBreakdown.total,
        paymentTerms: paymentBreakdown.paymentTerms,
        status: nextStatus,
        requiresApproval: false,
      },
    });
  }

  return updated;
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
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE (${Prisma.join(conditions, " OR ")})
    ORDER BY "createdAt" DESC
    LIMIT ${take}
  `);

  return rows.map(serializeQuoteRequest);
}

export async function getCustomerQuoteRequestById(input: {
  id: string;
  userId: string;
  phoneVariants: string[];
  normalizedEmails: string[];
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

  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE "id" = ${input.id}
      AND (${Prisma.join(conditions, " OR ")})
    LIMIT 1
  `);

  return rows[0] ? serializeQuoteRequest(rows[0]) : null;
}

export async function listAllQuoteRequests(input?: {
  status?: QuoteRequestStatus | "ALL";
  assignedAttendantId?: string | null;
  q?: string;
  source?: QuoteRequestSource | "ALL";
}) {
  await ensureQuoteRequestsSchema();
  const query = String(input?.q || "").trim();
  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE 1 = 1
      ${buildStatusWhere(input?.status || "ALL")}
      ${
        input?.assignedAttendantId
          ? Prisma.sql`AND "assignedAttendantId" = ${input.assignedAttendantId}`
          : Prisma.empty
      }
      ${
        input?.source && input.source !== "ALL"
          ? Prisma.sql`AND "source" = ${input.source}`
          : Prisma.empty
      }
      ${
        query
          ? Prisma.sql`AND (
              "quoteRef" ILIKE ${`%${query}%`}
              OR "customerName" ILIKE ${`%${query}%`}
              OR "customerPhone" ILIKE ${`%${query}%`}
              OR COALESCE("customerEmail", '') ILIKE ${`%${query}%`}
              OR COALESCE("quoteTitle", '') ILIKE ${`%${query}%`}
              OR COALESCE("templateName", '') ILIKE ${`%${query}%`}
            )`
          : Prisma.empty
      }
    ORDER BY "updatedAt" DESC, "createdAt" DESC
  `);

  return rows.map(serializeQuoteRequest);
}

export async function listQuotationEvents(quoteRequestId: string) {
  await ensureQuoteRequestsSchema();
  const rows = await prisma.$queryRaw<QuotationEventRow[]>(Prisma.sql`
    SELECT ${QUOTATION_EVENT_SELECT_SQL}
    FROM "QuotationEvent"
    WHERE "quoteRequestId" = ${quoteRequestId}
    ORDER BY "createdAt" DESC
  `);
  return rows.map(serializeQuotationEvent);
}

export async function bulkUpdateQuoteRequests(
  input: BulkQuoteRequestUpdateInput,
  actor: { userId: string; actorUserId?: string | null; name: string | null; email: string | null },
) {
  await ensureQuoteRequestsSchema();
  const ids = [...new Set(input.ids.map((value) => value.trim()).filter(Boolean))];
  if (!ids.length) return { updatedCount: 0, requests: [] as SerializedQuoteRequest[] };

  const assignee =
    input.assignedAttendantId === undefined
      ? undefined
      : input.assignedAttendantId
        ? await getQuoteStaffUserById(input.assignedAttendantId)
        : null;

  if (input.assignedAttendantId && !assignee) {
    throw new Error("Selected quotation owner was not found.");
  }

  const assignmentsChanged = input.assignedAttendantId !== undefined;
  const statusChanged = Boolean(input.status);

  if (!assignmentsChanged && !statusChanged) {
    const requests = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
      SELECT ${QUOTE_REQUEST_SELECT_SQL}
      FROM "QuoteRequest"
      WHERE "id" IN (${Prisma.join(ids)})
      ORDER BY "updatedAt" DESC, "createdAt" DESC
    `);
    return { updatedCount: requests.length, requests: requests.map(serializeQuoteRequest) };
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "QuoteRequest"
    SET
      "status" = ${input.status ?? Prisma.raw(`"status"`)},
      "assignedAttendantId" = ${
        assignmentsChanged ? (assignee?.id ?? null) : Prisma.raw(`"assignedAttendantId"`)
      },
      "assignedAttendantEmail" = ${
        assignmentsChanged ? (assignee?.email ?? null) : Prisma.raw(`"assignedAttendantEmail"`)
      },
      "assignedAttendantName" = ${
        assignmentsChanged ? (assignee?.name ?? null) : Prisma.raw(`"assignedAttendantName"`)
      },
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" IN (${Prisma.join(ids)})
  `);

  const requests = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
    FROM "QuoteRequest"
    WHERE "id" IN (${Prisma.join(ids)})
    ORDER BY "updatedAt" DESC, "createdAt" DESC
  `);

  const serialized = requests.map(serializeQuoteRequest);
  await Promise.all(
    serialized.map((request) =>
      appendQuotationEvent({
        quoteRequestId: request.id,
        eventType: statusChanged && assignmentsChanged ? "BULK_STATUS_AND_ASSIGNMENT_UPDATED" : statusChanged ? "BULK_STATUS_UPDATED" : "BULK_ASSIGNMENT_UPDATED",
        eventLabel: statusChanged && assignmentsChanged ? "Bulk status and owner updated" : statusChanged ? "Bulk status updated" : "Bulk owner updated",
        eventDetail: [
          statusChanged ? `Status: ${input.status}` : null,
          assignmentsChanged
            ? `Owner: ${assignee?.name || assignee?.email || "Unassigned"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        actorUserId: actor.actorUserId ?? actor.userId,
        actorName: actor.name ?? actor.email ?? "Quotation admin",
        metadata: {
          status: input.status ?? null,
          assignedAttendantId: assignee?.id ?? null,
        },
      }),
    ),
  );

  return { updatedCount: serialized.length, requests: serialized };
}

export async function createManualQuotation(
  input: ManualQuotationCreateInput,
  actor: { id: string; name: string | null; email: string | null },
) {
  const projectType = input.projectType || "SOLAR_HOME_SYSTEM";
  const quoteItems = sanitizeQuoteLineItems(input.quoteItems);
  if (!quoteItems.length) {
    throw new Error("Add at least one quotation item before saving the quotation.");
  }
  const subtotal = calculateQuoteTotal(quoteItems);
  const discountAmount = roundCurrency(Math.max(0, Number(input.discountAmount || 0)));
  const discountedTotal = roundCurrency(Math.max(0, subtotal - discountAmount));
  const paymentBreakdown = normalizeQuotePaymentBreakdown({
    total: discountedTotal,
    paymentTerms: input.paymentTerms,
    depositAmount: input.depositAmount,
    balanceAmount: input.balanceAmount,
  });
  const enriched = applyQuotationAiEnrichment({
    projectType,
    quoteTitle: input.quoteTitle || input.preferredProducts || projectType.replace(/_/g, " "),
    items: quoteItems,
    total: paymentBreakdown.total,
    paymentTerms: paymentBreakdown.paymentTerms,
    warrantyMode: (input.warrantyMode || "PER_ITEM") as QuoteWarrantyMode,
    fullSystemWarranty: input.fullSystemWarranty,
    customWarranty: input.customWarranty,
    quoteMessage: input.quoteMessage,
    customerNotes: input.notes,
    customerLocation: [input.specificLocation, input.town, input.county].filter(Boolean).join(", "),
    projectOverview: input.projectOverview,
    whatPriceIncludes: input.whatPriceIncludes,
    whatItCanPower: input.whatItCanPower,
    deliveryTimeline: input.deliveryTimeline,
    installationTimeline: input.installationTimeline,
    afterSalesSupport: input.afterSalesSupport,
    importantNotes: input.importantNotes,
    scopeExclusions: input.scopeExclusions,
    aiWarrantySummary: input.aiWarrantySummary,
  });
  const created = await createQuoteRequest({
    ...input,
    status: input.status || "QUOTED",
    source: input.source || "MANUAL",
    requiresApproval: false,
    assignedAttendantId: input.assignedAttendantId || actor.id,
    projectType,
    quoteTitle: input.quoteTitle || input.preferredProducts || projectType.replace(/_/g, " "),
    quoteMessage: input.quoteMessage,
    quotationData: {
      items: quoteItems,
      subtotal,
      total: paymentBreakdown.total,
      discountAmount,
      warrantyMode: (input.warrantyMode || "PER_ITEM") as QuoteWarrantyMode,
      fullSystemWarranty: input.fullSystemWarranty?.trim() || null,
      customWarranty: input.customWarranty?.trim() || null,
      warrantyGeneralNotes: input.warrantyGeneralNotes?.trim() || null,
      aiWarrantySummary: enriched.aiWarrantySummary?.trim() || null,
      projectOverview: enriched.projectOverview?.trim() || null,
      whatPriceIncludes: enriched.whatPriceIncludes?.trim() || null,
      whatItCanPower: enriched.whatItCanPower?.trim() || null,
      deliveryTimeline: enriched.deliveryTimeline?.trim() || null,
      installationTimeline: enriched.installationTimeline?.trim() || null,
      afterSalesSupport: enriched.afterSalesSupport?.trim() || null,
      importantNotes: enriched.importantNotes?.trim() || null,
      scopeExclusions: enriched.scopeExclusions?.trim() || null,
      similarProjects: input.similarProjects?.trim() || null,
      termsAndConditions: input.termsAndConditions?.trim() || null,
      preparedByDetails: input.preparedByDetails?.trim() || null,
      companyLegalDetails: input.companyLegalDetails?.trim() || null,
      projectReferenceLinks: input.projectReferenceLinks?.trim() || null,
      aiGeneratedSections: enriched.generated,
      proposalVisibility: Object.fromEntries(
        QUOTE_PROPOSAL_VISIBILITY_KEYS.map((key) => [key, input.proposalVisibility?.[key] !== false]),
      ),
      paymentMethod: input.paymentMethod || null,
      paymentTerms: paymentBreakdown.paymentTerms,
      deliveryMode: input.deliveryMode || "INCLUDED",
      installationMode: input.installationMode || "INCLUDED",
      depositAmount: paymentBreakdown.depositAmount,
      balanceAmount: paymentBreakdown.balanceAmount,
    },
    responseMetadata: {
      followUpNotes: input.followUpNotes?.trim() || null,
      sendEmail: false,
      sendSms: false,
      createdById: actor.id,
      createdByName: actor.name ?? actor.email ?? "Quotation attendant",
    },
    metadata: {
      sourceLabel: input.source || "MANUAL",
      approvalReason: null,
    },
  });

  if (created) {
    await appendQuotationEvent({
      quoteRequestId: created.id,
      eventType: "MANUAL_CREATED",
      eventLabel: "Manual quotation saved",
      eventDetail: created.quoteTitle || created.preferredProducts || null,
      actorUserId: actor.id,
      actorName: actor.name ?? actor.email ?? "Quotation attendant",
      metadata: {
        source: created.source,
        status: created.status,
        total: paymentBreakdown.total,
        discountAmount,
      },
    });
  }

  return created;
}

export async function createQuotationTemplate(
  input: QuotationTemplateInput,
  actor: { id: string; name: string | null; email: string | null },
) {
  await ensureQuoteRequestsSchema();
  const id = randomUUID();
  const owner = await getQuoteStaffUserById(input.ownerAttendantId ?? null);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "QuotationTemplate" (
      "id",
      "templateName",
      "category",
      "ownerAttendantId",
      "ownerAttendantEmail",
      "ownerAttendantName",
      "systemSize",
      "brand",
      "projectOverview",
      "whatItCanPower",
      "scopeOfWork",
      "deliveryTimeline",
      "installationTimeline",
      "warranty",
      "afterSalesSupport",
      "terms",
      "internalNotes",
      "defaultPaymentMethod",
      "defaultPaymentTerms",
      "defaultDepositAmount",
      "defaultBalanceAmount",
      "defaultPdfLayout",
      "isActive",
      "templateData",
      "createdById",
      "updatedById",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${id},
      ${input.templateName.trim()},
      ${input.category || null},
      ${owner?.id || null},
      ${owner?.email || null},
      ${owner?.name || null},
      ${input.systemSize?.trim() || null},
      ${input.brand?.trim() || null},
      ${input.projectOverview?.trim() || null},
      ${input.whatItCanPower?.trim() || null},
      ${input.scopeOfWork?.trim() || null},
      ${input.deliveryTimeline?.trim() || null},
      ${input.installationTimeline?.trim() || null},
      ${input.warranty?.trim() || null},
      ${input.afterSalesSupport?.trim() || null},
      ${input.terms?.trim() || null},
      ${input.internalNotes?.trim() || null},
      ${input.defaultPaymentMethod || null},
      ${input.defaultPaymentTerms || null},
      ${input.defaultDepositAmount ?? null},
      ${input.defaultBalanceAmount ?? null},
      ${input.defaultPdfLayout?.trim() || null},
      ${input.isActive !== false},
      ${{
        items: sanitizeQuoteLineItems(input.items),
        defaultDiscountAmount: input.defaultDiscountAmount ?? null,
        projectReferenceLinks: input.projectReferenceLinks?.trim() || null,
      } as Prisma.JsonObject},
      ${actor.id},
      ${actor.id},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);

  const rows = await prisma.$queryRaw<QuotationTemplateRow[]>(Prisma.sql`
    SELECT ${QUOTATION_TEMPLATE_SELECT_SQL}
    FROM "QuotationTemplate"
    WHERE "id" = ${id}
    LIMIT 1
  `);
  return rows[0] ? serializeQuotationTemplate(rows[0]) : null;
}

export async function listQuotationTemplates(options?: {
  activeOnly?: boolean;
  q?: string;
  ownerAttendantId?: string | null;
  viewerIsElevated?: boolean;
}) {
  await ensureQuoteRequestsSchema();
  const query = String(options?.q || "").trim();
  const rows = await prisma.$queryRaw<QuotationTemplateRow[]>(Prisma.sql`
    SELECT ${QUOTATION_TEMPLATE_SELECT_SQL}
    FROM "QuotationTemplate"
    WHERE 1 = 1
      ${options?.activeOnly ? Prisma.sql`AND "isActive" = TRUE` : Prisma.empty}
      ${
        options?.viewerIsElevated
          ? Prisma.empty
          : Prisma.sql`AND ("ownerAttendantId" IS NULL OR "ownerAttendantId" = ${options?.ownerAttendantId || null})`
      }
      ${
        query
          ? Prisma.sql`AND (
              "templateName" ILIKE ${`%${query}%`}
              OR COALESCE("brand", '') ILIKE ${`%${query}%`}
              OR COALESCE("systemSize", '') ILIKE ${`%${query}%`}
              OR COALESCE("category", '') ILIKE ${`%${query}%`}
            )`
          : Prisma.empty
      }
    ORDER BY "isActive" DESC, "updatedAt" DESC, "templateName" ASC
  `);
  return rows.map(serializeQuotationTemplate);
}

export async function duplicateQuotationTemplate(
  templateId: string,
  actor: { id: string; name: string | null; email: string | null },
) {
  const templates = await prisma.$queryRaw<QuotationTemplateRow[]>(Prisma.sql`
    SELECT ${QUOTATION_TEMPLATE_SELECT_SQL}
    FROM "QuotationTemplate"
    WHERE "id" = ${templateId}
    LIMIT 1
  `);
  const existing = templates[0];
  if (!existing) return null;
  return createQuotationTemplate(
    {
      templateName: `${existing.templateName} Copy`,
      category: isQuoteTemplateCategory(existing.category) ? existing.category : undefined,
      ownerAttendantId: existing.ownerAttendantId || undefined,
      systemSize: existing.systemSize || undefined,
      brand: existing.brand || undefined,
      projectReferenceLinks:
        typeof asJsonObject(existing.templateData)?.projectReferenceLinks === "string"
          ? (asJsonObject(existing.templateData)?.projectReferenceLinks as string)
          : undefined,
      projectOverview: existing.projectOverview || undefined,
      whatItCanPower: existing.whatItCanPower || undefined,
      scopeOfWork: existing.scopeOfWork || undefined,
      deliveryTimeline: existing.deliveryTimeline || undefined,
      installationTimeline: existing.installationTimeline || undefined,
      warranty: existing.warranty || undefined,
      afterSalesSupport: existing.afterSalesSupport || undefined,
      terms: existing.terms || undefined,
      internalNotes: existing.internalNotes || undefined,
      defaultPaymentMethod: (existing.defaultPaymentMethod as QuotePaymentMethod | null) || undefined,
      defaultPaymentTerms: (existing.defaultPaymentTerms as QuotePaymentTerms | null) || undefined,
      defaultDepositAmount: existing.defaultDepositAmount ?? undefined,
      defaultBalanceAmount: existing.defaultBalanceAmount ?? undefined,
      defaultPdfLayout: existing.defaultPdfLayout || undefined,
      isActive: existing.isActive,
      items: Array.isArray(asJsonObject(existing.templateData)?.items)
        ? ((asJsonObject(existing.templateData)?.items as Array<z.infer<typeof quoteLineItemSchema>>))
        : [],
    },
    actor,
  );
}

export async function updateQuotationTemplate(
  templateId: string,
  input: QuotationTemplateInput,
  actor: { id: string; name: string | null; email: string | null },
) {
  await ensureQuoteRequestsSchema();
  const owner = await getQuoteStaffUserById(input.ownerAttendantId ?? null);
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "QuotationTemplate"
    SET
      "templateName" = ${input.templateName.trim()},
      "category" = ${input.category || null},
      "ownerAttendantId" = ${owner?.id || null},
      "ownerAttendantEmail" = ${owner?.email || null},
      "ownerAttendantName" = ${owner?.name || null},
      "systemSize" = ${input.systemSize?.trim() || null},
      "brand" = ${input.brand?.trim() || null},
      "projectOverview" = ${input.projectOverview?.trim() || null},
      "whatItCanPower" = ${input.whatItCanPower?.trim() || null},
      "scopeOfWork" = ${input.scopeOfWork?.trim() || null},
      "deliveryTimeline" = ${input.deliveryTimeline?.trim() || null},
      "installationTimeline" = ${input.installationTimeline?.trim() || null},
      "warranty" = ${input.warranty?.trim() || null},
      "afterSalesSupport" = ${input.afterSalesSupport?.trim() || null},
      "terms" = ${input.terms?.trim() || null},
      "internalNotes" = ${input.internalNotes?.trim() || null},
      "defaultPaymentMethod" = ${input.defaultPaymentMethod || null},
      "defaultPaymentTerms" = ${input.defaultPaymentTerms || null},
      "defaultDepositAmount" = ${input.defaultDepositAmount ?? null},
      "defaultBalanceAmount" = ${input.defaultBalanceAmount ?? null},
      "defaultPdfLayout" = ${input.defaultPdfLayout?.trim() || null},
      "isActive" = ${input.isActive !== false},
      "templateData" = ${{
        items: sanitizeQuoteLineItems(input.items),
        defaultDiscountAmount: input.defaultDiscountAmount ?? null,
        projectReferenceLinks: input.projectReferenceLinks?.trim() || null,
      } as Prisma.JsonObject},
      "updatedById" = ${actor.id},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${templateId}
  `);

  const rows = await prisma.$queryRaw<QuotationTemplateRow[]>(Prisma.sql`
    SELECT ${QUOTATION_TEMPLATE_SELECT_SQL}
    FROM "QuotationTemplate"
    WHERE "id" = ${templateId}
    LIMIT 1
  `);
  return rows[0] ? serializeQuotationTemplate(rows[0]) : null;
}

export async function deleteQuotationTemplate(templateId: string) {
  await ensureQuoteRequestsSchema();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    DELETE FROM "QuotationTemplate"
    WHERE "id" = ${templateId}
    RETURNING "id"
  `);
  return Boolean(rows[0]?.id);
}
