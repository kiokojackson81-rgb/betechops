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
  type QuotePaymentMethod,
  type QuotePaymentTerms,
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
  `CREATE INDEX IF NOT EXISTS "QuoteRequest_source_createdAt_idx" ON "QuoteRequest"("source","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "QuoteRequest_templateId_createdAt_idx" ON "QuoteRequest"("templateId","createdAt")`,
  `CREATE TABLE IF NOT EXISTS "QuotationTemplate" (
    "id" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "category" TEXT,
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
  `CREATE INDEX IF NOT EXISTS "QuotationTemplate_isActive_updatedAt_idx" ON "QuotationTemplate"("isActive","updatedAt")`,
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

export const QUOTE_REQUEST_STATUSES = [
  "DRAFT",
  "NEW",
  "CONTACTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "VIEWED",
  "QUOTED",
  "FOLLOW_UP",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
  "CLOSED",
  "EXPIRED",
] as const;

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

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

export const quotationTemplateSchema = z.object({
  templateName: z.string().trim().min(2).max(200),
  category: z.enum(QUOTE_TEMPLATE_CATEGORIES).optional().or(z.literal("")),
  systemSize: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(120).optional(),
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
  defaultPdfLayout: z.string().trim().max(120).optional(),
  isActive: z.boolean().optional(),
  items: z.array(quoteLineItemSchema).default([]),
});

export type QuotationTemplateInput = z.infer<typeof quotationTemplateSchema>;

export const manualQuotationCreateSchema = quoteRequestCreateSchema.extend({
  status: z.enum(QUOTE_REQUEST_STATUSES).optional(),
  source: z.enum(QUOTE_REQUEST_SOURCES).optional(),
  assignedAttendantId: z.string().trim().optional(),
  templateId: z.string().trim().optional(),
  templateName: z.string().trim().optional(),
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
  defaultPaymentMethod: QuotePaymentMethod | null;
  defaultPaymentTerms: QuotePaymentTerms | null;
  defaultDepositAmount: number | null;
  defaultBalanceAmount: number | null;
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
  const items = Array.isArray(templateData?.items) ? (templateData?.items as Array<z.infer<typeof quoteLineItemSchema>>) : [];
  return {
    id: row.id,
    templateName: row.templateName,
    category: isQuoteTemplateCategory(row.category) ? row.category : null,
    systemSize: row.systemSize,
    brand: row.brand,
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

async function getQuoteStaffUserById(userId: string | null | undefined) {
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
      ${input.status || "NEW"},
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
    SELECT ${QUOTE_REQUEST_SELECT_SQL}
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
        WHEN "status" = 'DRAFT' THEN 1
        WHEN "status" = 'NEW' THEN 2
        WHEN "status" = 'PENDING_APPROVAL' THEN 3
        WHEN "status" = 'APPROVED' THEN 4
        WHEN "status" = 'CONTACTED' THEN 5
        WHEN "status" = 'SENT' THEN 6
        WHEN "status" = 'VIEWED' THEN 7
        WHEN "status" = 'FOLLOW_UP' THEN 8
        WHEN "status" = 'QUOTED' THEN 9
        WHEN "status" = 'ACCEPTED' THEN 10
        WHEN "status" = 'CONVERTED' THEN 11
        ELSE 12
      END ASC,
      "createdAt" DESC
  `);

  return rows.map(serializeQuoteRequest);
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
  const approvalPolicy = getQuotationApprovalPolicy({
    total: paymentBreakdown.total,
    paymentTerms: input.paymentTerms,
  });
  const nextStatus =
    input.status === "APPROVED" && approvalPolicy.requiresApproval
      ? "PENDING_APPROVAL"
      : input.status;

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "QuoteRequest"
    SET
      "status" = ${nextStatus},
      "quoteTitle" = ${input.quoteTitle?.trim() || null},
      "quoteMessage" = ${input.quoteMessage?.trim() || null},
      "quotationData" = ${quotationData as Prisma.JsonObject},
      "responseMetadata" = ${responseMetadata as Prisma.JsonObject},
      "requiresApproval" = ${approvalPolicy.requiresApproval},
      "approvalReason" = ${approvalPolicy.reason},
      "submittedForApprovalAt" = ${
        nextStatus === "PENDING_APPROVAL" ? Prisma.sql`CURRENT_TIMESTAMP` : Prisma.sql`"submittedForApprovalAt"`
      },
      "submittedForApprovalById" = ${nextStatus === "PENDING_APPROVAL" ? user.id : null},
      "approvedAt" = ${
        nextStatus === "APPROVED" ? Prisma.sql`CURRENT_TIMESTAMP` : Prisma.sql`"approvedAt"`
      },
      "approvedById" = ${nextStatus === "APPROVED" ? user.id : null},
      "approvedByName" = ${nextStatus === "APPROVED" ? (user.name ?? user.email ?? "Quotation attendant") : null},
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
        nextStatus === "PENDING_APPROVAL"
          ? "Submitted for approval"
          : nextStatus === "APPROVED"
            ? "Quotation approved"
            : nextStatus === "SENT"
              ? "Quotation sent"
              : "Quotation updated",
      eventDetail: input.quoteTitle?.trim() || input.followUpNotes?.trim() || null,
      actorUserId: user.id,
      actorName: user.name ?? user.email ?? "Quotation attendant",
      metadata: {
        total: paymentBreakdown.total,
        paymentTerms: paymentBreakdown.paymentTerms,
        status: nextStatus,
        requiresApproval: approvalPolicy.requiresApproval,
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

export async function createManualQuotation(
  input: ManualQuotationCreateInput,
  actor: { id: string; name: string | null; email: string | null },
) {
  const quoteItems = sanitizeQuoteLineItems(input.quoteItems);
  if (!quoteItems.length) {
    throw new Error("Add at least one quotation item before saving the quotation.");
  }
  const subtotal = calculateQuoteTotal(quoteItems);
  const paymentBreakdown = normalizeQuotePaymentBreakdown({
    total: subtotal,
    paymentTerms: input.paymentTerms,
    depositAmount: input.depositAmount,
    balanceAmount: input.balanceAmount,
  });
  const approvalPolicy = getQuotationApprovalPolicy({
    total: paymentBreakdown.total,
    paymentTerms: input.paymentTerms,
  });

  const created = await createQuoteRequest({
    ...input,
    status: input.status || (approvalPolicy.requiresApproval ? "PENDING_APPROVAL" : "QUOTED"),
    source: input.source || "MANUAL",
    requiresApproval: approvalPolicy.requiresApproval,
    quoteTitle: input.quoteTitle || input.preferredProducts || input.projectType.replace(/_/g, " "),
    quoteMessage: input.quoteMessage,
    quotationData: {
      items: quoteItems,
      subtotal,
      total: paymentBreakdown.total,
      paymentMethod: input.paymentMethod || null,
      paymentTerms: paymentBreakdown.paymentTerms,
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
      approvalReason: approvalPolicy.reason,
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
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "QuotationTemplate" (
      "id",
      "templateName",
      "category",
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
}) {
  await ensureQuoteRequestsSchema();
  const query = String(options?.q || "").trim();
  const rows = await prisma.$queryRaw<QuotationTemplateRow[]>(Prisma.sql`
    SELECT ${QUOTATION_TEMPLATE_SELECT_SQL}
    FROM "QuotationTemplate"
    WHERE 1 = 1
      ${options?.activeOnly ? Prisma.sql`AND "isActive" = TRUE` : Prisma.empty}
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
      systemSize: existing.systemSize || undefined,
      brand: existing.brand || undefined,
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
