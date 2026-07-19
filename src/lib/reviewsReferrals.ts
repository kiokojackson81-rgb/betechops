import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { sendOtpSms, sendTransactionalSms } from "@/lib/africasTalking";
import { generateReferralCode } from "@/lib/agents/generateReferralCode";
import { findOrCreateCustomerIdentityUser, findSafeUserById } from "@/lib/customerIdentity";
import { updateSafeCustomerProfile, updateSafeUserById } from "@/lib/customerProfile";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { assertNoSelfReferralForReview, claimReferralOwnershipLock, ensureReferralFraudSchema } from "@/lib/referralFraud";
import { pushReceiptToChatrace } from "@/lib/integrations/chatrace";
import { hasWhatsAppConfig, sendWhatsAppTextMessage } from "@/lib/notifications/whatsapp";
import { normalizeKenyanPhone } from "@/lib/phone";
import { createOtpCodeForChannel, createDirectVerifiedAuthToken, readVerifiedAuthToken, verifyOtpCodeForChannel } from "@/lib/phoneOtpAuth";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_REFERRAL_COOKIE_NAME,
  CUSTOMER_REFERRAL_COOKIE_TTL_SECONDS,
  REFERRAL_ACTIVATION_SESSION_COOKIE,
} from "@/lib/referralCookies";

const REVIEW_REFERRAL_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS "ReviewInvitation" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "customerUserId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerTown" TEXT,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "websiteOrderId" TEXT,
    "orderId" TEXT,
    "receiptId" TEXT,
    "orderOrReceiptRef" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "deliveryMode" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledSendAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewInvitation_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReviewInvitation_tokenHash_key" ON "ReviewInvitation"("tokenHash")`,
  `CREATE INDEX IF NOT EXISTS "ReviewInvitation_productId_reviewStatus_idx" ON "ReviewInvitation"("productId","reviewStatus")`,
  `CREATE INDEX IF NOT EXISTS "ReviewInvitation_customerPhone_createdAt_idx" ON "ReviewInvitation"("customerPhone","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ReviewInvitation_expiresAt_reviewStatus_idx" ON "ReviewInvitation"("expiresAt","reviewStatus")`,
  `ALTER TABLE "ReviewInvitation" ADD COLUMN IF NOT EXISTS "publicToken" TEXT`,
  `ALTER TABLE "ReviewInvitation" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT`,
  `ALTER TABLE "ReviewInvitation" ADD COLUMN IF NOT EXISTS "sendAttempts" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "ReviewInvitation" ADD COLUMN IF NOT EXISTS "lastSendAttemptAt" TIMESTAMP(3)`,
  `ALTER TABLE "ReviewInvitation" ADD COLUMN IF NOT EXISTS "lastSendStatus" TEXT`,
  `ALTER TABLE "ReviewInvitation" ADD COLUMN IF NOT EXISTS "lastSendError" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReviewInvitation_publicToken_key" ON "ReviewInvitation"("publicToken") WHERE "publicToken" IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS "ProductReviewSubmission" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerUserId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerTown" TEXT,
    "reviewTitle" TEXT,
    "reviewBody" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "productPerformanceRating" INTEGER,
    "customerServiceRating" INTEGER,
    "fulfillmentRating" INTEGER,
    "fulfillmentType" TEXT,
    "wouldRecommend" TEXT,
    "hasProblem" BOOLEAN NOT NULL DEFAULT FALSE,
    "problemDescription" TEXT,
    "preferredContactNumber" TEXT,
    "bestTimeToContact" TEXT,
    "publicationConsent" BOOLEAN NOT NULL DEFAULT FALSE,
    "published" BOOLEAN NOT NULL DEFAULT FALSE,
    "publishedAt" TIMESTAMP(3),
    "moderationStatus" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductReviewSubmission_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ProductReviewSubmission_invitationId_key" ON "ProductReviewSubmission"("invitationId")`,
  `CREATE INDEX IF NOT EXISTS "ProductReviewSubmission_productId_published_createdAt_idx" ON "ProductReviewSubmission"("productId","published","createdAt")`,
  `CREATE TABLE IF NOT EXISTS "ReviewSupportRequest" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "customerUserId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "issueDescription" TEXT NOT NULL,
    "preferredContactNumber" TEXT,
    "bestTimeToContact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewSupportRequest_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ReviewSupportRequest_status_createdAt_idx" ON "ReviewSupportRequest"("status","createdAt")`,
  `CREATE TABLE IF NOT EXISTS "ProductReferralPolicy" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "commissionRate" NUMERIC(8,2),
    "fixedAmount" NUMERIC(12,2),
    "maximumAmount" NUMERIC(12,2),
    "minimumQualifyingSale" NUMERIC(12,2),
    "holdingDays" INTEGER NOT NULL DEFAULT 7,
    "requiresFullPayment" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductReferralPolicy_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ProductReferralPolicy_productId_key" ON "ProductReferralPolicy"("productId")`,
  `CREATE TABLE IF NOT EXISTS "ReferralAccount" (
    "id" TEXT NOT NULL,
    "customerUserId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_activation',
    "activationTokenHash" TEXT,
    "activationExpiresAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralAccount_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralAccount_customerPhone_key" ON "ReferralAccount"("customerPhone")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralAccount_activationTokenHash_key" ON "ReferralAccount"("activationTokenHash")`,
  `CREATE TABLE IF NOT EXISTS "ReferralLink" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "referredName" TEXT,
    "referredPhone" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "referralUrl" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LINK_CREATED',
    "potentialCommission" NUMERIC(12,2) NOT NULL DEFAULT 0,
    "saleAmount" NUMERIC(12,2),
    "commissionStatus" TEXT NOT NULL DEFAULT 'COMMISSION_PENDING',
    "matchedWebsiteOrderId" TEXT,
    "matchedReceiptId" TEXT,
    "saleConfirmedAt" TIMESTAMP(3),
    "commissionAvailableAt" TIMESTAMP(3),
    "policySnapshot" JSONB,
    "metadata" JSONB,
    "clickedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralLink_referralCode_key" ON "ReferralLink"("referralCode")`,
  `CREATE INDEX IF NOT EXISTS "ReferralLink_accountId_createdAt_idx" ON "ReferralLink"("accountId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ReferralLink_referredPhone_createdAt_idx" ON "ReferralLink"("referredPhone","createdAt")`,
  `ALTER TABLE "ReferralLink" ADD COLUMN IF NOT EXISTS "saleAmount" NUMERIC(12,2)`,
  `ALTER TABLE "ReferralLink" ADD COLUMN IF NOT EXISTS "matchedWebsiteOrderId" TEXT`,
  `ALTER TABLE "ReferralLink" ADD COLUMN IF NOT EXISTS "matchedReceiptId" TEXT`,
  `ALTER TABLE "ReferralLink" ADD COLUMN IF NOT EXISTS "saleConfirmedAt" TIMESTAMP(3)`,
  `ALTER TABLE "ReferralLink" ADD COLUMN IF NOT EXISTS "commissionAvailableAt" TIMESTAMP(3)`,
  `CREATE TABLE IF NOT EXISTS "ReferralEvent" (
    "id" TEXT NOT NULL,
    "referralLinkId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sessionId" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ReferralEvent_referralLinkId_createdAt_idx" ON "ReferralEvent"("referralLinkId","createdAt")`,
  `CREATE TABLE IF NOT EXISTS "ReferralWithdrawalRequest" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" NUMERIC(12,2) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'M_PESA',
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT,
    "reason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralWithdrawalRequest_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ReferralWithdrawalRequest_accountId_createdAt_idx" ON "ReferralWithdrawalRequest"("accountId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ReferralWithdrawalRequest_status_createdAt_idx" ON "ReferralWithdrawalRequest"("status","createdAt")`,
  `CREATE TABLE IF NOT EXISTS "ReferralWithdrawalAllocation" (
    "id" TEXT NOT NULL,
    "withdrawalRequestId" TEXT NOT NULL,
    "referralLinkId" TEXT NOT NULL,
    "amount" NUMERIC(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralWithdrawalAllocation_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralWithdrawalAllocation_referralLinkId_key" ON "ReferralWithdrawalAllocation"("referralLinkId")`,
  `CREATE INDEX IF NOT EXISTS "ReferralWithdrawalAllocation_withdrawalRequestId_idx" ON "ReferralWithdrawalAllocation"("withdrawalRequestId")`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ReviewInvitation_productId_fkey' AND table_name = 'ReviewInvitation'
    ) THEN
      ALTER TABLE "ReviewInvitation"
      ADD CONSTRAINT "ReviewInvitation_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ProductReviewSubmission_productId_fkey' AND table_name = 'ProductReviewSubmission'
    ) THEN
      ALTER TABLE "ProductReviewSubmission"
      ADD CONSTRAINT "ProductReviewSubmission_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ProductReviewSubmission_invitationId_fkey' AND table_name = 'ProductReviewSubmission'
    ) THEN
      ALTER TABLE "ProductReviewSubmission"
      ADD CONSTRAINT "ProductReviewSubmission_invitationId_fkey"
      FOREIGN KEY ("invitationId") REFERENCES "ReviewInvitation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ReviewSupportRequest_reviewId_fkey' AND table_name = 'ReviewSupportRequest'
    ) THEN
      ALTER TABLE "ReviewSupportRequest"
      ADD CONSTRAINT "ReviewSupportRequest_reviewId_fkey"
      FOREIGN KEY ("reviewId") REFERENCES "ProductReviewSubmission"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ReferralLink_accountId_fkey' AND table_name = 'ReferralLink'
    ) THEN
      ALTER TABLE "ReferralLink"
      ADD CONSTRAINT "ReferralLink_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "ReferralAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ReferralLink_reviewId_fkey' AND table_name = 'ReferralLink'
    ) THEN
      ALTER TABLE "ReferralLink"
      ADD CONSTRAINT "ReferralLink_reviewId_fkey"
      FOREIGN KEY ("reviewId") REFERENCES "ProductReviewSubmission"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ReferralEvent_referralLinkId_fkey' AND table_name = 'ReferralEvent'
    ) THEN
      ALTER TABLE "ReferralEvent"
      ADD CONSTRAINT "ReferralEvent_referralLinkId_fkey"
      FOREIGN KEY ("referralLinkId") REFERENCES "ReferralLink"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ReferralWithdrawalRequest_accountId_fkey' AND table_name = 'ReferralWithdrawalRequest'
    ) THEN
      ALTER TABLE "ReferralWithdrawalRequest"
      ADD CONSTRAINT "ReferralWithdrawalRequest_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "ReferralAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ReferralWithdrawalAllocation_withdrawalRequestId_fkey' AND table_name = 'ReferralWithdrawalAllocation'
    ) THEN
      ALTER TABLE "ReferralWithdrawalAllocation"
      ADD CONSTRAINT "ReferralWithdrawalAllocation_withdrawalRequestId_fkey"
      FOREIGN KEY ("withdrawalRequestId") REFERENCES "ReferralWithdrawalRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ReferralWithdrawalAllocation_referralLinkId_fkey' AND table_name = 'ReferralWithdrawalAllocation'
    ) THEN
      ALTER TABLE "ReferralWithdrawalAllocation"
      ADD CONSTRAINT "ReferralWithdrawalAllocation_referralLinkId_fkey"
      FOREIGN KEY ("referralLinkId") REFERENCES "ReferralLink"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
] as const;

const globalReviewReferralState = globalThis as typeof globalThis & {
  __reviewReferralSchemaReady?: Promise<void>;
};

export const MIN_REFERRAL_WITHDRAWAL_AMOUNT = 1000;
const REVIEW_INVITATION_CHATRACE_TAG = (process.env.CHATRACE_POST_PURCHASE_REVIEW_TAG || "post_purchase_review").trim();
export type ReviewInvitationTestChannel = "sms" | "whatsapp" | "email";

const nullableString = z.string().trim().optional().nullable();

export const createReviewInvitationSchema = z.object({
  productId: z.string().trim().min(1),
  websiteOrderId: nullableString,
  orderId: nullableString,
  receiptId: nullableString,
  customerUserId: nullableString,
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().min(7),
  customerEmail: nullableString,
  customerTown: nullableString,
  orderOrReceiptRef: nullableString,
  purchaseDate: z.coerce.date().optional(),
  scheduledSendAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  deliveryMode: nullableString,
});

export const submitReviewSchema = z
  .object({
    overallRating: z.number().int().min(1).max(5),
    productPerformanceRating: z.number().int().min(1).max(5).optional().nullable(),
    customerServiceRating: z.number().int().min(1).max(5).optional().nullable(),
    fulfillmentRating: z.number().int().min(1).max(5).optional().nullable(),
    fulfillmentType: nullableString,
    reviewTitle: nullableString,
    reviewBody: z.string().trim().min(10).max(5000),
    wouldRecommend: z.enum(["yes", "maybe", "no"]).optional().nullable(),
    hasProblem: z.boolean().optional().default(false),
    problemDescription: nullableString,
    preferredContactNumber: nullableString,
    bestTimeToContact: nullableString,
    publicationConsent: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.hasProblem && !String(value.problemDescription || "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please describe the issue you are experiencing.",
        path: ["problemDescription"],
      });
    }
  });

export const createReferralSchema = z.object({
  token: z.string().trim().min(8),
  referredPhone: z.string().trim().min(7),
  referredName: nullableString,
  channel: z.enum(["whatsapp", "sms", "copy"]).default("whatsapp"),
});

export const createReferralWithdrawalSchema = z.object({
  token: z.string().trim().min(8),
  amount: z.coerce.number().positive(),
});

export type ReviewInvitationDetails = {
  invitationId: string;
  token: string;
  isTestMode: boolean;
  reviewStatus: string;
  expiresAt: string;
  purchaseDate: string;
  sentAt: string | null;
  scheduledSendAt: string | null;
  usedAt: string | null;
  customer: {
    firstName: string;
    town: string | null;
    phoneMasked: string;
  };
  product: {
    id: string;
    name: string;
    currentPrice: number;
    warranty: string | null;
    imageUrl: string | null;
    slug: string;
    category: string | null;
  };
  order: {
    websiteOrderId: string | null;
    orderId: string | null;
    receiptId: string | null;
    orderOrReceiptRef: string | null;
    deliveryMode: string | null;
  };
  purchasedItems: Array<{
    productId: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    isPrimary: boolean;
  }>;
  review: ReturnType<typeof presentReviewRow> | null;
};

type ReviewInvitationAdminRow = {
  id: string;
  customerUserId: string | null;
  customerName: string;
  customerPhoneRaw: string;
  customerPhone: string;
  customerEmail: string | null;
  productName: string;
  reviewStatus: string;
  scheduledSendAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  sendAttempts: number;
  lastSendAttemptAt: string | null;
  lastSendStatus: string | null;
  lastSendError: string | null;
  lastViewedAt: string | null;
  websiteOrderId: string | null;
  orderId: string | null;
  receiptId: string | null;
  orderOrReceiptRef: string | null;
};

type SubmittedReviewAdminRow = {
  id: string;
  invitationId: string;
  customerName: string;
  customerPhoneRaw: string;
  customerPhone: string;
  customerTown: string | null;
  productId: string;
  productName: string;
  productUrl: string;
  reviewTitle: string | null;
  reviewBody: string;
  overallRating: number;
  wouldRecommend: string | null;
  published: boolean;
  publishedAt: string | null;
  moderationStatus: string;
  hasProblem: boolean;
  websiteOrderId: string | null;
  orderId: string | null;
  receiptId: string | null;
  orderOrReceiptRef: string | null;
  orderUrl: string | null;
  createdAt: string | null;
};

type PurchaseContext = {
  productId: string;
  productName: string;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerTown: string | null;
  purchaseDate: Date;
  orderOrReceiptRef: string | null;
  deliveryMode: string | null;
  websiteOrderId: string | null;
  orderId: string | null;
  receiptId: string | null;
};

type ReferralPolicy = {
  productId: string;
  enabled: boolean;
  commissionType: "PERCENTAGE" | "FIXED";
  commissionRate: number | null;
  fixedAmount: number | null;
  maximumAmount: number | null;
  minimumQualifyingSale: number | null;
  holdingDays: number;
  requiresFullPayment: boolean;
};

function toDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function asString(value: unknown) {
  return value == null ? "" : String(value);
}

function cleanOptional(value: unknown) {
  const cleaned = asString(value).trim();
  return cleaned || null;
}

function toPositiveNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function readJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] || "Customer";
}

function slugifyProductName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildProductUrl(slug: string) {
  return `https://www.betech.co.ke/${slug}`;
}

function buildReviewOrderUrl(input: {
  websiteOrderId?: string | null;
  receiptId?: string | null;
}) {
  if (cleanOptional(input.receiptId)) {
    return `/receipts/${cleanOptional(input.receiptId)}`;
  }
  if (cleanOptional(input.websiteOrderId)) {
    return `/admin/receipts?tab=website-orders&orderId=${encodeURIComponent(cleanOptional(input.websiteOrderId) || "")}`;
  }
  return null;
}

function maskPhone(phone: string) {
  const normalized = normalizeKenyanPhone(phone);
  if (!normalized) return phone;
  const local = `0${normalized.slice(4)}`;
  return `${local.slice(0, 4)} *** ${local.slice(-3)}`;
}

function presentWithdrawalRow(row: Record<string, unknown>) {
  return {
    id: asString(row.id),
    amount: toNumber(row.amount),
    method: asString(row.method),
    phone: maskPhone(asString(row.phone)),
    status: asString(row.status),
    reference: cleanOptional(row.reference),
    reason: cleanOptional(row.reason),
    paidAt: toDate(row.paidAt)?.toISOString() || null,
    createdAt: toDate(row.createdAt)?.toISOString() || null,
    updatedAt: toDate(row.updatedAt)?.toISOString() || null,
  };
}

function buildReviewToken() {
  return `rvw_${randomBytes(12).toString("base64url")}`;
}

function buildActivationToken() {
  return `act_${randomBytes(18).toString("base64url")}`;
}

async function generateUniqueAgentReferralCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateReferralCode();
    const existing = await prisma.agentProfile.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Unable to generate a unique agent referral code.");
}

function splitCustomerName(name: string) {
  const parts = String(name || "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" ") || parts[0] || "Customer",
  };
}

function buildReferralCode() {
  return `BRF-${randomBytes(5).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8)}`;
}

export function hashPublicToken(token: string) {
  return createHash("sha256").update(String(token || "").trim()).digest("hex");
}

export function buildReviewInvitationOutboundMessage(input: {
  customerName: string;
  productName: string;
  reviewUrl: string;
}) {
  const firstName = firstNameOf(input.customerName);
  return `Hello ${firstName}, thank you for shopping with us recently. We'd appreciate it if you could share your review of the product here: ${input.reviewUrl}. Your feedback helps us improve our service, and you can also earn referral rewards. Thank you!`;
}

export function buildReviewInvitationWhatsAppMessage(input: {
  customerName: string;
  productName: string;
  reviewUrl: string;
}) {
  const firstName = firstNameOf(input.customerName);
  return [
    `Hello ${firstName},`,
    "",
    "Thank you for shopping with us recently at Betech Solar Solutions.",
    `We'd appreciate it if you could share your review of the product here: ${input.reviewUrl}`,
    "",
    "Your feedback helps us improve our service, and you can also earn referral rewards.",
    "Thank you!",
  ].join("\n");
}

function buildReviewInvitationWhatsAppChatraceFields(input: {
  invitationId: string;
  customerName: string;
  productName: string;
  reviewUrl: string;
  orderOrReceiptRef: string;
  whatsappMessage: string;
}) {
  const firstName = firstNameOf(input.customerName);
  return {
    customer_name: input.customerName,
    customer_full_name: input.customerName,
    customer_first_name: firstName,
    first_name: firstName,
    review_url: input.reviewUrl,
    review_link: input.reviewUrl,
    review_invitation_url: input.reviewUrl,
    receipt_url: input.reviewUrl,
    receipt_link: input.reviewUrl,
    review_invitation_id: input.invitationId,
    review_reference: input.orderOrReceiptRef,
    review_product_name: input.productName,
    product_name: input.productName,
    whatsapp_message_preview: input.whatsappMessage,
    "1": firstName,
    "2": input.reviewUrl,
  } satisfies Record<string, string>;
}

function buildReviewInvitationEmailPayload(input: {
  customerName: string;
  reviewUrl: string;
}) {
  const firstName = firstNameOf(input.customerName);
  return {
    subject: "Please review your recent Betech Solar purchase",
    title: "Share your product review",
    intro: `Hello ${firstName},`,
    bodyHtml:
      "<p>Thank you for shopping with us recently.</p><p>We'd appreciate it if you could share your review of the product by clicking the button below.</p><p>Your feedback helps us improve our service, and you can also earn referral rewards.</p>",
    bodyText: `Hello ${firstName},\n\nThank you for shopping with us recently.\nWe'd appreciate it if you could share your review of the product here: ${input.reviewUrl}\n\nYour feedback helps us improve our service, and you can also earn referral rewards.\nThank you!`,
    ctaLabel: "Share your review",
    ctaUrl: input.reviewUrl,
    outro: "Thank you for choosing Betech Solar Solutions.",
  };
}

export function getReviewInvitationExpiry(baseDate = new Date()) {
  return new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000);
}

export function getReviewSendDate(baseDate = new Date()) {
  return new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function calculateReferralCommission(
  saleAmount: number,
  policy: Pick<ReferralPolicy, "commissionType" | "commissionRate" | "fixedAmount" | "maximumAmount" | "minimumQualifyingSale">,
) {
  const normalizedSaleAmount = roundMoney(Math.max(0, Number(saleAmount || 0)));
  const minimum = policy.minimumQualifyingSale == null ? null : Number(policy.minimumQualifyingSale);
  if (minimum != null && normalizedSaleAmount < minimum) {
    return 0;
  }

  let commission = 0;
  if (policy.commissionType === "FIXED") {
    commission = Number(policy.fixedAmount || 0);
  } else {
    commission = normalizedSaleAmount * (Number(policy.commissionRate || 0) / 100);
  }

  if (policy.maximumAmount != null) {
    commission = Math.min(commission, Number(policy.maximumAmount));
  }

  return roundMoney(Math.max(0, commission));
}

async function executeReviewReferralSchema() {
  for (const statement of REVIEW_REFERRAL_SCHEMA_SQL) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export async function ensureReviewReferralSchema() {
  if (!globalReviewReferralState.__reviewReferralSchemaReady) {
    globalReviewReferralState.__reviewReferralSchemaReady = executeReviewReferralSchema().catch((error) => {
      globalReviewReferralState.__reviewReferralSchemaReady = undefined;
      throw error;
    });
  }

  await globalReviewReferralState.__reviewReferralSchemaReady;
}

async function getProductSummary(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      category: true,
      sellingPrice: true,
      defaultWarranty: true,
      shopWarranty: true,
      shopImageUrl: true,
      mainImageUrl: true,
    },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  return product;
}

async function resolvePurchaseContext(input: z.infer<typeof createReviewInvitationSchema>): Promise<PurchaseContext> {
  const product = await getProductSummary(input.productId);
  const normalizedPhone = normalizeKenyanPhone(input.customerPhone);
  if (!normalizedPhone) {
    throw new Error("A valid Kenyan customer phone number is required.");
  }

  if (input.websiteOrderId) {
    const websiteOrder = await prisma.websiteOrder.findUnique({
      where: { id: input.websiteOrderId },
      include: {
        items: {
          where: { productId: input.productId },
          take: 1,
        },
        customerUser: { select: { id: true, town: true } },
      },
    });

    if (!websiteOrder) throw new Error("Website order not found.");
    const matchedItem = websiteOrder.items[0];
    if (!matchedItem) {
      throw new Error("The selected review product does not belong to this website order.");
    }

    return {
      productId: product.id,
      productName: cleanOptional(matchedItem.productName) || product.name,
      customerUserId: websiteOrder.customerUserId,
      customerName: cleanOptional(websiteOrder.customerName) || input.customerName,
      customerPhone: normalizeKenyanPhone(websiteOrder.customerPhone) || normalizedPhone,
      customerEmail: cleanOptional(websiteOrder.customerEmail),
      customerTown: websiteOrder.customerUser?.town || input.customerTown || null,
      purchaseDate: websiteOrder.createdAt,
      orderOrReceiptRef: websiteOrder.orderRef,
      deliveryMode: websiteOrder.deliveryMethod || input.deliveryMode || null,
      websiteOrderId: websiteOrder.id,
      orderId: null,
      receiptId: websiteOrder.receiptId || null,
    };
  }

  if (input.receiptId) {
    const receipt = await prisma.receipt.findUnique({
      where: { id: input.receiptId },
      include: {
        order: {
          include: {
            items: {
              where: { productId: input.productId },
              take: 1,
              include: {
                product: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!receipt?.order) throw new Error("Receipt not found.");
    const matchedItem = receipt.order.items[0];
    if (!matchedItem) {
      throw new Error("The selected review product does not belong to this receipt.");
    }

    return {
      productId: product.id,
      productName: cleanOptional(matchedItem.product?.name) || product.name,
      customerUserId: null,
      customerName: cleanOptional(receipt.order.customerName) || input.customerName,
      customerPhone: normalizeKenyanPhone(receipt.order.customerPhone || "") || normalizedPhone,
      customerEmail: cleanOptional(receipt.order.customerEmail),
      customerTown: input.customerTown || null,
      purchaseDate: receipt.generatedAt,
      orderOrReceiptRef: receipt.receiptNumber || receipt.order.orderNumber,
      deliveryMode: input.deliveryMode || null,
      websiteOrderId: null,
      orderId: receipt.orderId,
      receiptId: receipt.id,
    };
  }

  if (input.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        items: {
          where: { productId: input.productId },
          take: 1,
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order) throw new Error("Order not found.");
    const matchedItem = order.items[0];
    if (!matchedItem) {
      throw new Error("The selected review product does not belong to this order.");
    }

    return {
      productId: product.id,
      productName: cleanOptional(matchedItem.product?.name) || product.name,
      customerUserId: null,
      customerName: cleanOptional(order.customerName) || input.customerName,
      customerPhone: normalizeKenyanPhone(order.customerPhone || "") || normalizedPhone,
      customerEmail: cleanOptional(order.customerEmail),
      customerTown: input.customerTown || null,
      purchaseDate: order.createdAt,
      orderOrReceiptRef: order.orderNumber,
      deliveryMode: input.deliveryMode || null,
      websiteOrderId: null,
      orderId: order.id,
      receiptId: null,
    };
  }

  return {
    productId: product.id,
    productName: product.name,
    customerUserId: input.customerUserId || null,
    customerName: input.customerName,
    customerPhone: normalizedPhone,
    customerEmail: cleanOptional(input.customerEmail),
    customerTown: input.customerTown || null,
    purchaseDate: input.purchaseDate || new Date(),
    orderOrReceiptRef: input.orderOrReceiptRef || null,
    deliveryMode: input.deliveryMode || null,
    websiteOrderId: null,
    orderId: null,
    receiptId: null,
  };
}

async function getReferralPolicyForProduct(productId: string): Promise<ReferralPolicy> {
  await ensureReviewReferralSchema();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ProductReferralPolicy" WHERE "productId" = $1 LIMIT 1`,
    productId,
  );

  if (rows[0]) {
    return {
      productId,
      enabled: Boolean(rows[0].enabled),
      commissionType: String(rows[0].commissionType || "PERCENTAGE").toUpperCase() === "FIXED" ? "FIXED" : "PERCENTAGE",
      commissionRate: rows[0].commissionRate == null ? null : toNumber(rows[0].commissionRate),
      fixedAmount: rows[0].fixedAmount == null ? null : toNumber(rows[0].fixedAmount),
      maximumAmount: rows[0].maximumAmount == null ? null : toNumber(rows[0].maximumAmount),
      minimumQualifyingSale: rows[0].minimumQualifyingSale == null ? null : toNumber(rows[0].minimumQualifyingSale),
      holdingDays: Math.max(0, Number(rows[0].holdingDays ?? 7)),
      requiresFullPayment: Boolean(rows[0].requiresFullPayment),
    };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      commissionEnabled: true,
      commissionAmount: true,
    },
  });

  return {
    productId,
    enabled: Boolean(product?.commissionEnabled),
    commissionType: "FIXED",
    commissionRate: null,
    fixedAmount: product?.commissionAmount == null ? null : toNumber(product.commissionAmount),
    maximumAmount: null,
    minimumQualifyingSale: null,
    holdingDays: 7,
    requiresFullPayment: true,
  };
}

function presentReviewRow(row: Record<string, unknown>) {
  return {
    id: asString(row.id),
    reviewTitle: cleanOptional(row.reviewTitle),
    reviewBody: asString(row.reviewBody),
    overallRating: Number(row.overallRating || 0),
    productPerformanceRating: row.productPerformanceRating == null ? null : Number(row.productPerformanceRating),
    customerServiceRating: row.customerServiceRating == null ? null : Number(row.customerServiceRating),
    fulfillmentRating: row.fulfillmentRating == null ? null : Number(row.fulfillmentRating),
    fulfillmentType: cleanOptional(row.fulfillmentType),
    wouldRecommend: cleanOptional(row.wouldRecommend),
    hasProblem: Boolean(row.hasProblem),
    published: Boolean(row.published),
    moderationStatus: asString(row.moderationStatus || "pending"),
    customerName: asString(row.customerName),
    customerTown: cleanOptional(row.customerTown),
    createdAt: toDate(row.createdAt)?.toISOString() || null,
    publishedAt: toDate(row.publishedAt)?.toISOString() || null,
  };
}

async function getReviewRowByInvitationId(invitationId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ProductReviewSubmission" WHERE "invitationId" = $1 LIMIT 1`,
    invitationId,
  );
  return rows[0] ? presentReviewRow(rows[0]) : null;
}

function summarizeWebsiteOrderItem(item: Record<string, unknown>, primaryProductId: string | null) {
  const quantity = Math.max(1, Number(item.quantity || 1));
  const unitPrice =
    toPositiveNumber(item.unitPrice) ||
    toPositiveNumber(item.sellingPrice) ||
    toPositiveNumber(item.price);
  const lineTotal =
    toPositiveNumber(item.total) ||
    toPositiveNumber(item.totalPrice) ||
    toPositiveNumber(item.lineTotal) ||
    unitPrice * quantity;
  const productId = cleanOptional(item.productId);
  const name =
    cleanOptional(item.productName) ||
    cleanOptional(item.name) ||
    "Purchased item";

  return {
    productId,
    name,
    quantity,
    unitPrice,
    lineTotal,
    isPrimary: Boolean(primaryProductId) && productId === primaryProductId,
  };
}

function pickPrimaryWebsiteOrderItem(items: Array<Record<string, unknown>>) {
  const eligible = items.filter((item) => cleanOptional(item.productId));
  if (!eligible.length) return null;
  return eligible
    .map((item) => ({
      raw: item,
      score:
        toPositiveNumber(item.total) ||
        toPositiveNumber(item.totalPrice) ||
        toPositiveNumber(item.lineTotal) ||
        toPositiveNumber(item.unitPrice) * Math.max(1, Number(item.quantity || 1)) ||
        toPositiveNumber(item.sellingPrice) * Math.max(1, Number(item.quantity || 1)),
    }))
    .sort((a, b) => b.score - a.score)[0]?.raw || null;
}

async function getInvitationRowByToken(token: string) {
  await ensureReviewReferralSchema();
  const tokenHash = hashPublicToken(token);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReviewInvitation" WHERE "tokenHash" = $1 LIMIT 1`,
    tokenHash,
  );
  return rows[0] ?? null;
}

async function touchInvitationLastViewed(invitationId: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "ReviewInvitation" SET "lastViewedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
    invitationId,
  );
}

async function presentInvitationRow(row: Record<string, unknown>, token: string): Promise<ReviewInvitationDetails> {
  const productId = asString(row.productId);
  const product = await getProductSummary(productId);
  const review = await getReviewRowByInvitationId(asString(row.id));
  const websiteOrderId = cleanOptional(row.websiteOrderId);
  const purchasedItems = websiteOrderId
    ? ((await prisma.websiteOrder.findUnique({
        where: { id: websiteOrderId },
        include: {
          items: true,
        },
      }))?.items || []).map((item) => summarizeWebsiteOrderItem(item as unknown as Record<string, unknown>, productId))
    : [
        {
          productId,
          name: product.name,
          quantity: 1,
          unitPrice: Number(product.sellingPrice || 0),
          lineTotal: Number(product.sellingPrice || 0),
          isPrimary: true,
        },
      ];
  const slug = slugifyProductName(product.name);
  const orderRef = cleanOptional(row.orderOrReceiptRef) || "";
  const isTestMode = orderRef.startsWith("TEST-");
  return {
    invitationId: asString(row.id),
    token,
    isTestMode,
    reviewStatus: asString(row.reviewStatus || "PENDING"),
    expiresAt: toDate(row.expiresAt)?.toISOString() || "",
    purchaseDate: toDate(row.purchaseDate)?.toISOString() || "",
    sentAt: toDate(row.sentAt)?.toISOString() || null,
    scheduledSendAt: toDate(row.scheduledSendAt)?.toISOString() || null,
    usedAt: toDate(row.usedAt)?.toISOString() || null,
    customer: {
      firstName: firstNameOf(asString(row.customerName)),
      town: cleanOptional(row.customerTown),
      phoneMasked: maskPhone(asString(row.customerPhone)),
    },
    product: {
      id: product.id,
      name: product.name,
      currentPrice: Number(product.sellingPrice || 0),
      warranty: product.shopWarranty || product.defaultWarranty || null,
      imageUrl: product.shopImageUrl || product.mainImageUrl || null,
      slug,
      category: product.category || null,
    },
    order: {
      websiteOrderId,
      orderId: cleanOptional(row.orderId),
      receiptId: cleanOptional(row.receiptId),
      orderOrReceiptRef: cleanOptional(row.orderOrReceiptRef),
      deliveryMode: cleanOptional(row.deliveryMode),
    },
    purchasedItems,
    review,
  };
}

async function ensureInvitationPublicToken(row: Record<string, unknown>) {
  const existingToken = cleanOptional(row.publicToken);
  if (existingToken) {
    return existingToken;
  }

  const nextToken = buildReviewToken();
  await prisma.$executeRawUnsafe(
    `
      UPDATE "ReviewInvitation"
      SET
        "publicToken" = $2,
        "tokenHash" = $3,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    asString(row.id),
    nextToken,
    hashPublicToken(nextToken),
  );

  return nextToken;
}

function getInvitationBaseDateFromWebsiteOrder(order: {
  createdAt: Date;
  metadata?: Prisma.JsonValue | null;
}) {
  const metadata = readJsonObject(order.metadata);
  const receiptIssuedAt = toDate(metadata.receiptIssuedAt);
  const paymentConfirmedAt = toDate(metadata.paymentConfirmedAt);
  const processingAt = toDate(metadata.processingAt);
  return receiptIssuedAt || paymentConfirmedAt || processingAt || order.createdAt;
}

function presentReviewInvitationAdminRow(row: Record<string, unknown>): ReviewInvitationAdminRow {
  return {
    id: asString(row.id),
    customerUserId: cleanOptional(row.customerUserId),
    customerName: asString(row.customerName),
    customerPhoneRaw: asString(row.customerPhone),
    customerPhone: maskPhone(asString(row.customerPhone)),
    customerEmail: cleanOptional(row.customerEmail),
    productName: asString(row.productName),
    reviewStatus: asString(row.reviewStatus || "PENDING"),
    scheduledSendAt: toDate(row.scheduledSendAt)?.toISOString() || null,
    sentAt: toDate(row.sentAt)?.toISOString() || null,
    expiresAt: toDate(row.expiresAt)?.toISOString() || null,
    sendAttempts: Number(row.sendAttempts || 0),
    lastSendAttemptAt: toDate(row.lastSendAttemptAt)?.toISOString() || null,
    lastSendStatus: cleanOptional(row.lastSendStatus),
    lastSendError: cleanOptional(row.lastSendError),
    lastViewedAt: toDate(row.lastViewedAt)?.toISOString() || null,
    websiteOrderId: cleanOptional(row.websiteOrderId),
    orderId: cleanOptional(row.orderId),
    receiptId: cleanOptional(row.receiptId),
    orderOrReceiptRef: cleanOptional(row.orderOrReceiptRef),
  };
}

export async function createReviewInvitation(input: z.infer<typeof createReviewInvitationSchema>) {
  await ensureReviewReferralSchema();
  const context = await resolvePurchaseContext(input);
  const reviewToken = buildReviewToken();
  const invitationId = crypto.randomUUID();
  const tokenHash = hashPublicToken(reviewToken);
  const scheduledSendAt = input.scheduledSendAt || getReviewSendDate(context.purchaseDate);
  const expiresAt = input.expiresAt || getReviewInvitationExpiry(context.purchaseDate);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "ReviewInvitation" (
        "id", "tokenHash", "publicToken", "customerUserId", "customerName", "customerPhone", "customerEmail", "customerTown",
        "productId", "productName", "websiteOrderId", "orderId", "receiptId", "orderOrReceiptRef",
        "purchaseDate", "deliveryMode", "scheduledSendAt", "expiresAt", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `,
    invitationId,
    tokenHash,
    reviewToken,
    context.customerUserId,
    context.customerName,
    context.customerPhone,
    context.customerEmail,
    context.customerTown,
    context.productId,
    context.productName,
    context.websiteOrderId,
    context.orderId,
    context.receiptId,
    context.orderOrReceiptRef,
    context.purchaseDate,
    context.deliveryMode,
    scheduledSendAt,
    expiresAt,
  );

  const row = await getInvitationRowByToken(reviewToken);
  if (!row) throw new Error("Failed to create review invitation.");

  return {
    invitation: await presentInvitationRow(row, reviewToken),
    reviewUrl: `https://www.betech.co.ke/review/${reviewToken}`,
  };
}

export async function createAdminTestReviewLink(input?: {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerTown?: string | null;
  sendNow?: boolean;
}) {
  await ensureReviewReferralSchema();

  const customerName = String(input?.customerName || "Jackson").trim() || "Jackson";
  const customerPhone = String(input?.customerPhone || "0705663175").trim() || "0705663175";
  const customerEmail = cleanOptional(input?.customerEmail);
  const customerTown = cleanOptional(input?.customerTown) || "Nairobi";
  const sku = "TEST-REVIEW-JACKSON-0705663175";
  const imageUrl = "https://www.betech.co.ke/agents/product-solar-kit-clean.png";

  const product = await prisma.product.upsert({
    where: { sku },
    update: {
      name: "Betech Review Test Solar Kit",
      category: "Testing",
      sellingPrice: 24999,
      commissionEnabled: true,
      commissionAmount: 0,
      showInShop: true,
      ecommerceVisible: true,
      shopWarranty: "12 months",
      shopImageUrl: imageUrl,
      mainImageUrl: imageUrl,
      shortDescription: "Temporary product used for review flow testing.",
      description: "Temporary product used for review flow testing.",
      stockQuantity: 5,
      isActive: true,
      status: "ACTIVE",
      availabilityType: "SHOP",
    },
    create: {
      sku,
      name: "Betech Review Test Solar Kit",
      category: "Testing",
      sellingPrice: 24999,
      commissionEnabled: true,
      commissionAmount: 0,
      showInShop: true,
      ecommerceVisible: true,
      shopWarranty: "12 months",
      shopImageUrl: imageUrl,
      mainImageUrl: imageUrl,
      shortDescription: "Temporary product used for review flow testing.",
      description: "Temporary product used for review flow testing.",
      stockQuantity: 5,
      isActive: true,
      status: "ACTIVE",
      availabilityType: "SHOP",
    },
    select: {
      id: true,
      name: true,
      category: true,
      sellingPrice: true,
      shopWarranty: true,
      defaultWarranty: true,
      shopImageUrl: true,
      mainImageUrl: true,
    },
  });

  const referralPolicyId = `test-policy-${product.id}`;
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "ProductReferralPolicy" (
        "id", "productId", "enabled", "commissionType", "commissionRate", "fixedAmount",
        "maximumAmount", "minimumQualifyingSale", "holdingDays", "requiresFullPayment",
        "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, TRUE, 'PERCENTAGE', 6, NULL,
        NULL, NULL, 7, TRUE,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("productId")
      DO UPDATE SET
        "enabled" = TRUE,
        "commissionType" = 'PERCENTAGE',
        "commissionRate" = 6,
        "fixedAmount" = NULL,
        "maximumAmount" = NULL,
        "minimumQualifyingSale" = NULL,
        "holdingDays" = 7,
        "requiresFullPayment" = TRUE,
        "updatedAt" = CURRENT_TIMESTAMP
    `,
    referralPolicyId,
    product.id,
  );

  const now = new Date();
  const purchaseDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const scheduledSendAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const result = await createReviewInvitation({
    productId: product.id,
    websiteOrderId: null,
    orderId: null,
    receiptId: null,
    customerUserId: null,
    customerName,
    customerPhone,
    customerEmail,
    customerTown,
    orderOrReceiptRef: `TEST-${customerName.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${now.toISOString().slice(0, 10).replace(/-/g, "")}`,
    purchaseDate,
    scheduledSendAt,
    deliveryMode: "pickup",
  });

  let dispatch: Record<string, unknown> | null = null;
  if (input?.sendNow) {
    const createdRow = await getInvitationRowByToken(result.invitation.token);
    if (!createdRow) {
      throw new Error("Unable to load the created test invitation for sending.");
    }
    dispatch = await processReviewInvitationSend(createdRow);
  }

  return {
    ...result,
    outboundMessage: buildReviewInvitationOutboundMessage({
      customerName,
      productName: product.name,
      reviewUrl: result.reviewUrl,
    }),
    outboundWhatsAppMessage: buildReviewInvitationWhatsAppMessage({
      customerName,
      productName: product.name,
      reviewUrl: result.reviewUrl,
    }),
    dispatch,
    product: {
      id: product.id,
      name: product.name,
      category: product.category,
      currentPrice: Number(product.sellingPrice || 0),
      warranty: product.shopWarranty || product.defaultWarranty || null,
      imageUrl: product.shopImageUrl || product.mainImageUrl || null,
      slug: slugifyProductName(product.name),
    },
  };
}

export async function deleteAdminTestReviewLink(invitationId: string) {
  await ensureReviewReferralSchema();

  const invitationRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT ri.*, p."sku" AS "productSku"
      FROM "ReviewInvitation" ri
      LEFT JOIN "Product" p ON p."id" = ri."productId"
      WHERE ri."id" = $1
      LIMIT 1
    `,
    invitationId,
  );
  const invitation = invitationRows[0];
  if (!invitation) {
    throw new Error("Test review invitation not found.");
  }

  const productSku = cleanOptional(invitation.productSku);
  const orderRef = cleanOptional(invitation.orderOrReceiptRef) || "";
  const isTestInvitation = productSku === "TEST-REVIEW-JACKSON-0705663175" || orderRef.startsWith("TEST-");
  if (!isTestInvitation) {
    throw new Error("Only admin test review invitations can be deleted from this tool.");
  }

  const reviewRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT "id" FROM "ProductReviewSubmission" WHERE "invitationId" = $1 LIMIT 1`,
    invitationId,
  );
  const reviewId = cleanOptional(reviewRows[0]?.id);

  let accountId: string | null = null;
  if (reviewId) {
    const accountRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT DISTINCT "accountId" FROM "ReferralLink" WHERE "reviewId" = $1 AND "accountId" IS NOT NULL`,
      reviewId,
    );
    accountId = cleanOptional(accountRows[0]?.accountId);

    await prisma.$executeRawUnsafe(
      `
        DELETE FROM "ReferralEvent"
        WHERE "referralLinkId" IN (
          SELECT "id" FROM "ReferralLink" WHERE "reviewId" = $1
        )
      `,
      reviewId,
    );
    await prisma.$executeRawUnsafe(
      `
        DELETE FROM "ReferralWithdrawalAllocation"
        WHERE "referralLinkId" IN (
          SELECT "id" FROM "ReferralLink" WHERE "reviewId" = $1
        )
      `,
      reviewId,
    );
    await prisma.$executeRawUnsafe(`DELETE FROM "ReferralLink" WHERE "reviewId" = $1`, reviewId);
    await prisma.$executeRawUnsafe(`DELETE FROM "ReviewSupportRequest" WHERE "reviewId" = $1`, reviewId);
    await prisma.$executeRawUnsafe(`DELETE FROM "ProductReviewSubmission" WHERE "id" = $1`, reviewId);
  }

  await prisma.$executeRawUnsafe(`DELETE FROM "ReviewInvitation" WHERE "id" = $1`, invitationId);

  if (accountId) {
    const accountUsageRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT
          EXISTS(SELECT 1 FROM "ReferralLink" WHERE "accountId" = $1) AS "hasLinks",
          EXISTS(SELECT 1 FROM "ReferralWithdrawalRequest" WHERE "accountId" = $1) AS "hasWithdrawals"
      `,
      accountId,
    );
    const hasLinks = Boolean(accountUsageRows[0]?.hasLinks);
    const hasWithdrawals = Boolean(accountUsageRows[0]?.hasWithdrawals);
    if (!hasLinks && !hasWithdrawals) {
      await prisma.$executeRawUnsafe(`DELETE FROM "ReferralAccount" WHERE "id" = $1`, accountId);
    }
  }

  if (productSku === "TEST-REVIEW-JACKSON-0705663175") {
    const remainingProductRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT
          EXISTS(SELECT 1 FROM "ReviewInvitation" WHERE "productId" = $1) AS "hasInvitations",
          EXISTS(SELECT 1 FROM "ProductReviewSubmission" WHERE "productId" = $1) AS "hasReviews"
      `,
      asString(invitation.productId),
    );
    const hasInvitations = Boolean(remainingProductRows[0]?.hasInvitations);
    const hasReviews = Boolean(remainingProductRows[0]?.hasReviews);
    if (!hasInvitations && !hasReviews) {
      await prisma.product.delete({ where: { id: asString(invitation.productId) } }).catch(() => null);
    }
  }

  return { deletedInvitationId: invitationId };
}

export async function getReviewInvitationDetailsByToken(token: string) {
  const row = await getInvitationRowByToken(token);
  if (!row) return null;
  await touchInvitationLastViewed(asString(row.id));
  return presentInvitationRow(row, token);
}

export async function ensureReviewInvitationsForWebsiteOrder(orderId: string) {
  await ensureReviewReferralSchema();
  const order = await prisma.websiteOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      customerUser: { select: { id: true, town: true } },
    },
  });
  if (!order) {
    throw new Error("Website order not found.");
  }
  if (String(order.status || "").toUpperCase() === "CANCELLED") {
    return { created: 0, skipped: 0 };
  }
  const purchaseBaseDate = getInvitationBaseDateFromWebsiteOrder(order);

  const eligibleItems = order.items.filter((item) => cleanOptional(item.productId));
  if (!eligibleItems.length) {
    return { created: 0, skipped: order.items.length };
  }

  const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT "id"
      FROM "ReviewInvitation"
      WHERE "websiteOrderId" = $1
      LIMIT 1
    `,
    order.id,
  );
  if (existingRows[0]?.id) {
    return { created: 0, skipped: eligibleItems.length };
  }

  const primaryItem = pickPrimaryWebsiteOrderItem(eligibleItems as unknown as Array<Record<string, unknown>>);
  const productId = cleanOptional(primaryItem?.productId);
  if (!productId) {
    return { created: 0, skipped: eligibleItems.length };
  }

  await createReviewInvitation({
    productId,
    websiteOrderId: order.id,
    orderId: null,
    receiptId: order.receiptId,
    customerUserId: order.customerUserId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerTown: order.customerUser?.town || null,
    orderOrReceiptRef: order.orderRef,
    purchaseDate: purchaseBaseDate,
    deliveryMode: order.deliveryMethod,
    scheduledSendAt: getReviewSendDate(purchaseBaseDate),
    expiresAt: getReviewInvitationExpiry(purchaseBaseDate),
  });

  return { created: 1, skipped: Math.max(0, eligibleItems.length - 1) };
}

async function processReviewInvitationSend(
  row: Record<string, unknown>,
  options?: { dryRun?: boolean },
) {
  const invitationId = asString(row.id);
  const status = cleanOptional((await prisma.websiteOrder.findUnique({
    where: { id: cleanOptional(row.websiteOrderId) || "__missing__" },
    select: { status: true },
  }).catch(() => null))?.status);

  if (status && status.toUpperCase() === "CANCELLED") {
    if (!options?.dryRun) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE "ReviewInvitation"
          SET
            "sendAttempts" = COALESCE("sendAttempts", 0) + 1,
            "lastSendAttemptAt" = CURRENT_TIMESTAMP,
            "lastSendStatus" = 'SKIPPED_CANCELLED',
            "lastSendError" = 'Website order cancelled.',
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1
        `,
        invitationId,
      );
    }
    return { invitationId, status: "skipped", reason: "website_order_cancelled" } as Record<string, unknown>;
  }

  const publicToken = await ensureInvitationPublicToken(row);
  const reviewUrl = `https://www.betech.co.ke/review/${publicToken}`;
  const smsMessage = buildReviewInvitationOutboundMessage({
    customerName: asString(row.customerName),
    productName: asString(row.productName),
    reviewUrl,
  });
  const whatsappMessage = buildReviewInvitationWhatsAppMessage({
    customerName: asString(row.customerName),
    productName: asString(row.productName),
    reviewUrl,
  });
  const phone = normalizeKenyanPhone(asString(row.customerPhone));
  const email = cleanOptional(row.customerEmail);
  if (!phone && !email) {
    if (!options?.dryRun) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE "ReviewInvitation"
          SET
            "sendAttempts" = COALESCE("sendAttempts", 0) + 1,
            "lastSendAttemptAt" = CURRENT_TIMESTAMP,
            "lastSendStatus" = 'FAILED',
            "lastSendError" = 'Invalid phone number.',
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1
        `,
        invitationId,
      );
    }
    return { invitationId, status: "failed", reason: "missing_phone_and_email" } as Record<string, unknown>;
  }

  if (options?.dryRun) {
    return { invitationId, status: "dry_run", phone, email, reviewUrl } as Record<string, unknown>;
  }

  let sent = false;
  const channels: string[] = [];
  const errors: string[] = [];

  if (phone) {
    try {
      if (hasWhatsAppConfig()) {
        await sendWhatsAppTextMessage({ to: phone, body: whatsappMessage, previewUrl: true });
      } else {
        const chatrace = await pushReceiptToChatrace({
          phoneE164: phone,
          customerName: asString(row.customerName),
          receiptNumber: cleanOptional(row.orderOrReceiptRef) || invitationId,
          amount: "0",
          currency: "KES",
          receiptLink: reviewUrl,
          receiptUrl: reviewUrl,
          tagName: REVIEW_INVITATION_CHATRACE_TAG,
          skipDefaultTags: true,
          extraFields: buildReviewInvitationWhatsAppChatraceFields({
            invitationId,
            customerName: asString(row.customerName),
            productName: asString(row.productName),
            reviewUrl,
            orderOrReceiptRef: cleanOptional(row.orderOrReceiptRef) || invitationId,
            whatsappMessage,
          }),
        });
        if (!chatrace.ok) {
          throw new Error(String(chatrace.debug?.error || "Chatrace WhatsApp trigger failed."));
        }
      }
      sent = true;
      channels.push("whatsapp");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "WhatsApp send failed.");
    }
  }

  if (phone) {
    try {
      await sendTransactionalSms(phone, smsMessage);
      sent = true;
      channels.push("sms");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "SMS send failed.");
    }
  }

  if (email) {
    try {
      await sendGeneralCustomerNotificationEmail({
        to: email,
        ...buildReviewInvitationEmailPayload({
          customerName: asString(row.customerName),
          reviewUrl,
        }),
      });
      sent = true;
      channels.push("email");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Email send failed.");
    }
  }

  if (!sent) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "ReviewInvitation"
        SET
          "sendAttempts" = COALESCE("sendAttempts", 0) + 1,
          "lastSendAttemptAt" = CURRENT_TIMESTAMP,
          "lastSendStatus" = 'FAILED',
          "lastSendError" = $2,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
      invitationId,
      errors.join(" | ").slice(0, 1000) || "Failed to send review invitation.",
    );
    return { invitationId, status: "failed", phone, errors } as Record<string, unknown>;
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE "ReviewInvitation"
      SET
        "sentAt" = CURRENT_TIMESTAMP,
        "sendAttempts" = COALESCE("sendAttempts", 0) + 1,
        "lastSendAttemptAt" = CURRENT_TIMESTAMP,
        "lastSendStatus" = 'SENT',
        "lastSendError" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    invitationId,
  );

  return { invitationId, status: "sent", phone, channels, reviewUrl } as Record<string, unknown>;
}

export async function processDueReviewInvitations(input?: { limit?: number; dryRun?: boolean }) {
  await ensureReviewReferralSchema();
  const limit = Math.min(Math.max(Number(input?.limit || 50), 1), 250);
  const now = new Date();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT *
      FROM "ReviewInvitation"
      WHERE "scheduledSendAt" IS NOT NULL
        AND "scheduledSendAt" <= $1
        AND "sentAt" IS NULL
        AND "usedAt" IS NULL
        AND "expiresAt" > $1
      ORDER BY "scheduledSendAt" ASC
      LIMIT $2
    `,
    now,
    limit,
  );

  const summary = {
    scanned: rows.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    results: [] as Array<Record<string, unknown>>,
  };

  for (const row of rows) {
    const result = await processReviewInvitationSend(row, { dryRun: input?.dryRun });
    if (String(result.status) === "failed") summary.failed += 1;
    else if (String(result.status) === "skipped") summary.skipped += 1;
    else summary.sent += 1;
    summary.results.push(result);
  }

  return summary;
}

export async function backfillReviewInvitationsForRecentSales(input?: {
  lookbackDays?: number;
  limit?: number;
  dryRun?: boolean;
  processDue?: boolean;
}) {
  await ensureReviewReferralSchema();

  const now = new Date();
  const lookbackDays = Math.min(Math.max(Number(input?.lookbackDays || 7), 1), 90);
  const limit = Math.min(Math.max(Number(input?.limit || 200), 1), 500);
  const windowStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const orders = await prisma.websiteOrder.findMany({
    where: {
      createdAt: {
        gte: windowStart,
        lte: now,
      },
      status: {
        not: "CANCELLED",
      },
    },
    select: {
      id: true,
      orderRef: true,
      createdAt: true,
      status: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  const summary = {
    lookbackDays,
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
    scannedOrders: orders.length,
    createdInvitations: 0,
    skippedInvitations: 0,
    touchedOrders: 0,
    dueProcessing: null as null | Awaited<ReturnType<typeof processDueReviewInvitations>>,
    orders: [] as Array<{
      websiteOrderId: string;
      orderRef: string | null;
      createdAt: string;
      status: string;
      created: number;
      skipped: number;
    }>,
  };

  if (!input?.dryRun) {
    for (const order of orders) {
      const result = await ensureReviewInvitationsForWebsiteOrder(order.id);
      summary.touchedOrders += 1;
      summary.createdInvitations += Number(result.created || 0);
      summary.skippedInvitations += Number(result.skipped || 0);
      summary.orders.push({
        websiteOrderId: order.id,
        orderRef: cleanOptional(order.orderRef),
        createdAt: order.createdAt.toISOString(),
        status: String(order.status || ""),
        created: Number(result.created || 0),
        skipped: Number(result.skipped || 0),
      });
    }
  }

  if (input?.processDue) {
    summary.dueProcessing = await processDueReviewInvitations({
      limit: Math.min(Math.max(limit, 1), 250),
      dryRun: Boolean(input?.dryRun),
    });
  }

  return summary;
}

export async function submitReviewByToken(token: string, input: z.infer<typeof submitReviewSchema>) {
  await ensureReviewReferralSchema();
  const invitation = await getInvitationRowByToken(token);
  if (!invitation) {
    throw new Error("Review invitation not found.");
  }

  const expiresAt = toDate(invitation.expiresAt);
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    throw new Error("This review invitation has expired.");
  }

  const invitationId = asString(invitation.id);
  const existingReview = await getReviewRowByInvitationId(invitationId);
  if (existingReview) {
    throw new Error("This review has already been submitted.");
  }

  const normalizedPreferredPhone = input.preferredContactNumber
    ? normalizeKenyanPhone(input.preferredContactNumber) || input.preferredContactNumber.trim()
    : null;

  const reviewId = crypto.randomUUID();
  const metadata: Record<string, unknown> = {
    submissionChannel: "review_invitation",
    invitationTokenHash: hashPublicToken(token),
  };

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        INSERT INTO "ProductReviewSubmission" (
          "id", "invitationId", "productId", "customerUserId", "customerName", "customerPhone", "customerTown",
          "reviewTitle", "reviewBody", "overallRating", "productPerformanceRating", "customerServiceRating",
          "fulfillmentRating", "fulfillmentType", "wouldRecommend", "hasProblem", "problemDescription",
          "preferredContactNumber", "bestTimeToContact", "publicationConsent", "published", "moderationStatus",
          "metadata", "createdAt", "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, FALSE, 'pending',
          $21::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
      reviewId,
      invitationId,
      asString(invitation.productId),
      cleanOptional(invitation.customerUserId),
      asString(invitation.customerName),
      asString(invitation.customerPhone),
      cleanOptional(invitation.customerTown),
      cleanOptional(input.reviewTitle),
      input.reviewBody.trim(),
      input.overallRating,
      input.productPerformanceRating ?? null,
      input.customerServiceRating ?? null,
      input.fulfillmentRating ?? null,
      cleanOptional(input.fulfillmentType),
      cleanOptional(input.wouldRecommend),
      Boolean(input.hasProblem),
      cleanOptional(input.problemDescription),
      normalizedPreferredPhone,
      cleanOptional(input.bestTimeToContact),
      Boolean(input.publicationConsent),
      JSON.stringify(metadata),
    );

    await tx.$executeRawUnsafe(
      `
        UPDATE "ReviewInvitation"
        SET "reviewStatus" = 'SUBMITTED', "usedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
      invitationId,
    );

    if (input.hasProblem && input.problemDescription) {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO "ReviewSupportRequest" (
            "id", "reviewId", "invitationId", "customerUserId", "customerName", "customerPhone",
            "productId", "productName", "issueDescription", "preferredContactNumber", "bestTimeToContact",
            "status", "createdAt", "updatedAt"
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
        crypto.randomUUID(),
        reviewId,
        invitationId,
        cleanOptional(invitation.customerUserId),
        asString(invitation.customerName),
        asString(invitation.customerPhone),
        asString(invitation.productId),
        asString(invitation.productName),
        input.problemDescription.trim(),
        normalizedPreferredPhone,
        cleanOptional(input.bestTimeToContact),
      );
    }
  });

  return getReviewInvitationDetailsByToken(token);
}

async function getOrCreateReferralAccount(input: {
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
}) {
  await ensureReviewReferralSchema();
  const normalizedPhone = normalizeKenyanPhone(input.customerPhone);
  if (!normalizedPhone) {
    throw new Error("A valid customer phone number is required.");
  }

  const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReferralAccount" WHERE "customerPhone" = $1 LIMIT 1`,
    normalizedPhone,
  );

  const activationToken = buildActivationToken();
  const activationTokenHash = hashPublicToken(activationToken);
  const activationExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  if (existingRows[0]) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "ReferralAccount"
        SET
          "customerUserId" = COALESCE("customerUserId", $2),
          "customerName" = $3,
          "activationTokenHash" = $4,
          "activationExpiresAt" = $5,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
      asString(existingRows[0].id),
      input.customerUserId,
      input.customerName,
      activationTokenHash,
      activationExpiresAt,
    );

    return {
      accountId: asString(existingRows[0].id),
      activationToken,
      activationUrl: `https://agents.betech.co.ke/activate?token=${activationToken}`,
    };
  }

  const accountId = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "ReferralAccount" (
        "id", "customerUserId", "customerName", "customerPhone", "status",
        "activationTokenHash", "activationExpiresAt", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4, 'pending_activation',
        $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `,
    accountId,
    input.customerUserId,
    input.customerName,
    normalizedPhone,
    activationTokenHash,
    activationExpiresAt,
  );

  return {
    accountId,
    activationToken,
    activationUrl: `https://agents.betech.co.ke/activate?token=${activationToken}`,
  };
}

export async function createReferralFromReview(input: z.infer<typeof createReferralSchema>) {
  await ensureReviewReferralSchema();
  await ensureReferralFraudSchema();
  const invitation = await getInvitationRowByToken(input.token);
  if (!invitation) throw new Error("Review invitation not found.");

  const reviewRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ProductReviewSubmission" WHERE "invitationId" = $1 LIMIT 1`,
    asString(invitation.id),
  );
  const review = reviewRows[0];

  const referredPhone = normalizeKenyanPhone(input.referredPhone);
  if (!referredPhone) throw new Error("A valid Kenyan phone number is required for the referral.");

  const product = await getProductSummary(asString(invitation.productId));
  const policy = await getReferralPolicyForProduct(product.id);
  if (!policy.enabled) {
    throw new Error("Referrals are not enabled for this product.");
  }

  const account = await getOrCreateReferralAccount({
    customerUserId: cleanOptional(invitation.customerUserId),
    customerName: asString(invitation.customerName),
    customerPhone: asString(invitation.customerPhone),
  });
  const referralCode = buildReferralCode();
  const productSlug = slugifyProductName(product.name);
  const referralUrl = `${buildProductUrl(productSlug)}?ref=${encodeURIComponent(referralCode)}`;
  const potentialCommission = calculateReferralCommission(Number(product.sellingPrice || 0), policy);
  const linkId = crypto.randomUUID();
  const policySnapshot = {
    ...policy,
    saleAmount: Number(product.sellingPrice || 0),
    computedCommission: potentialCommission,
  };

  await prisma.$transaction(async (tx) => {
    await assertNoSelfReferralForReview(tx, {
      customerUserId: cleanOptional(invitation.customerUserId),
      referrerPhone: asString(invitation.customerPhone),
      referredPhone,
      referralAccountId: account.accountId,
    });
    const ownershipLock = await claimReferralOwnershipLock(tx, {
      normalizedPhone: referredPhone,
      source: "post_review_referral",
      ownerType: "review_referral",
      ownerUserId: cleanOptional(invitation.customerUserId),
      ownerReferralAccountId: account.accountId,
      customerUserId: cleanOptional(invitation.customerUserId),
      customerName: cleanOptional(input.referredName),
      productName: product.name,
      reviewId: cleanOptional(review?.id),
      referralLinkId: linkId,
      metadata: {
        invitationId: asString(invitation.id),
        referralCode,
        channel: input.channel,
      },
    });

    await tx.$executeRawUnsafe(
      `
        INSERT INTO "ReferralLink" (
          "id", "accountId", "reviewId", "productId", "productName", "referredName", "referredPhone",
          "referralCode", "referralUrl", "channel", "ownershipLockId", "status", "potentialCommission", "commissionStatus",
          "policySnapshot", "metadata", "createdAt", "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, 'LINK_CREATED', $12, 'COMMISSION_PENDING',
          $13::jsonb, $14::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
      linkId,
      account.accountId,
      cleanOptional(review?.id),
      product.id,
      product.name,
      cleanOptional(input.referredName),
      referredPhone,
      referralCode,
      referralUrl,
      input.channel,
      ownershipLock.id,
      potentialCommission,
      JSON.stringify(policySnapshot),
      JSON.stringify({
        invitationId: asString(invitation.id),
        source: review ? "post_review_referral" : "review_invitation_referral",
      }),
    );

    await tx.$executeRawUnsafe(
      `
        INSERT INTO "ReferralEvent" ("id", "referralLinkId", "eventType", "source", "metadata", "createdAt")
        VALUES ($1, $2, 'LINK_CREATED', $3, $4::jsonb, CURRENT_TIMESTAMP)
      `,
      crypto.randomUUID(),
      linkId,
      input.channel,
      JSON.stringify({ referredName: cleanOptional(input.referredName) }),
    );
  });

  return {
    referralCode,
    referralUrl,
    potentialCommission,
    activationUrl: account.activationUrl,
    activationToken: account.activationToken,
    product: {
      id: product.id,
      name: product.name,
      price: Number(product.sellingPrice || 0),
    },
  };
}

export async function recordReferralClick(input: {
  referralCode: string;
  sessionId?: string | null;
  source?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await ensureReviewReferralSchema();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReferralLink" WHERE "referralCode" = $1 LIMIT 1`,
    input.referralCode,
  );
  const link = rows[0];
  if (!link) return null;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        UPDATE "ReferralLink"
        SET
          "status" = CASE WHEN "status" = 'LINK_CREATED' THEN 'LINK_CLICKED' ELSE "status" END,
          "clickedAt" = COALESCE("clickedAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
      asString(link.id),
    );
    await tx.$executeRawUnsafe(
      `
        INSERT INTO "ReferralEvent" ("id", "referralLinkId", "eventType", "sessionId", "source", "metadata", "createdAt")
        VALUES ($1, $2, 'LINK_CLICKED', $3, $4, $5::jsonb, CURRENT_TIMESTAMP)
      `,
      crypto.randomUUID(),
      asString(link.id),
      cleanOptional(input.sessionId),
      cleanOptional(input.source),
      JSON.stringify(input.metadata ?? {}),
    );
  });

  return {
    referralCode: asString(link.referralCode),
    referralUrl: asString(link.referralUrl),
    productId: asString(link.productId),
    productName: asString(link.productName),
  };
}

export async function getReferralLandingByCode(referralCode: string) {
  await ensureReviewReferralSchema();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReferralLink" WHERE "referralCode" = $1 LIMIT 1`,
    referralCode,
  );
  const link = rows[0];
  if (!link) return null;

  return {
    referralCode: asString(link.referralCode),
    referralUrl: asString(link.referralUrl),
    productId: asString(link.productId),
    productName: asString(link.productName),
    referredName: cleanOptional(link.referredName),
    potentialCommission: toNumber(link.potentialCommission),
    status: asString(link.status),
  };
}

export async function getPublishedProductReviews(productId: string) {
  await ensureReviewReferralSchema();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT *
      FROM "ProductReviewSubmission"
      WHERE "productId" = $1 AND "published" = TRUE
      ORDER BY "publishedAt" DESC NULLS LAST, "createdAt" DESC
    `,
    productId,
  );

  const reviews = rows.map((row) => {
    const fullName = asString(row.customerName);
    const firstName = firstNameOf(fullName);
    const maskedName = `${firstName} ${fullName.split(/\s+/).slice(1, 2).map((part) => `${part.charAt(0)}.`).join("")}`.trim();
    return {
      ...presentReviewRow(row),
      customerName: maskedName,
    };
  });

  const total = reviews.length;
  const averageRating = total
    ? roundMoney(reviews.reduce((sum, review) => sum + review.overallRating, 0) / total)
    : 0;

  return {
    total,
    averageRating,
    reviews,
  };
}

async function getReferralWithdrawalsForAccount(accountId: string) {
  return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReferralWithdrawalRequest" WHERE "accountId" = $1 ORDER BY "createdAt" DESC`,
    accountId,
  );
}

async function getAllocatedReferralLinkIds(accountId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT rwa."referralLinkId"
      FROM "ReferralWithdrawalAllocation" rwa
      INNER JOIN "ReferralWithdrawalRequest" rwr ON rwr."id" = rwa."withdrawalRequestId"
      WHERE rwr."accountId" = $1
        AND LOWER(rwr."status") IN ('pending', 'approved', 'held', 'paid')
    `,
    accountId,
  );
  return new Set(rows.map((row) => asString(row.referralLinkId)).filter(Boolean));
}

async function getAvailableReferralLinksForAccount(accountId: string) {
  const [links, allocatedLinkIds] = await Promise.all([
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "ReferralLink" WHERE "accountId" = $1 ORDER BY "createdAt" ASC`,
      accountId,
    ),
    getAllocatedReferralLinkIds(accountId),
  ]);

  return links.filter((row) => {
    if (String(row.commissionStatus || "").toUpperCase() !== "COMMISSION_AVAILABLE") return false;
    return !allocatedLinkIds.has(asString(row.id));
  });
}

function assertReferralActivation(sessionToken: string, account: Record<string, unknown>) {
  validateReferralActivationSession(sessionToken, asString(account.customerPhone));
}

export async function getReferralAccountDashboardByToken(token: string) {
  await ensureReviewReferralSchema();
  await refreshReferralCommissionAvailability();
  const tokenHash = hashPublicToken(token);
  const accounts = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReferralAccount" WHERE "activationTokenHash" = $1 LIMIT 1`,
    tokenHash,
  );
  const account = accounts[0];
  if (!account) return null;

  const expiresAt = toDate(account.activationExpiresAt);
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    throw new Error("This referral activation link has expired.");
  }

  const links = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReferralLink" WHERE "accountId" = $1 ORDER BY "createdAt" DESC`,
    asString(account.id),
  );
  const [withdrawals, availableLinks] = await Promise.all([
    getReferralWithdrawalsForAccount(asString(account.id)),
    getAvailableReferralLinksForAccount(asString(account.id)),
  ]);

  const totalReferrals = links.length;
  const potentialCommission = roundMoney(links.reduce((sum, row) => sum + toNumber(row.potentialCommission), 0));
  const availableBalance = roundMoney(availableLinks.reduce((sum, row) => sum + toNumber(row.potentialCommission), 0));
  const pendingWithdrawalAmount = roundMoney(
    withdrawals
      .filter((row) => ["pending", "approved", "held"].includes(String(row.status || "").toLowerCase()))
      .reduce((sum, row) => sum + toNumber(row.amount), 0),
  );
  const paidWithdrawalAmount = roundMoney(
    withdrawals
      .filter((row) => String(row.status || "").toLowerCase() === "paid")
      .reduce((sum, row) => sum + toNumber(row.amount), 0),
  );

  return {
    customerName: asString(account.customerName),
    customerPhone: maskPhone(asString(account.customerPhone)),
    status: asString(account.status),
    activationExpiresAt: expiresAt?.toISOString() || null,
    totals: {
      totalReferrals,
      potentialCommission,
      availableBalance,
      pendingWithdrawalAmount,
      paidWithdrawalAmount,
    },
    referrals: links.map((row) => ({
      referralCode: asString(row.referralCode),
      productName: asString(row.productName),
      referredName: cleanOptional(row.referredName),
      referredPhone: maskPhone(asString(row.referredPhone)),
      status: asString(row.status),
      commissionStatus: asString(row.commissionStatus),
      potentialCommission: toNumber(row.potentialCommission),
      createdAt: toDate(row.createdAt)?.toISOString() || null,
    })),
    withdrawals: withdrawals.map(presentWithdrawalRow),
  };
}

async function getReferralAccountRowByToken(token: string) {
  await ensureReviewReferralSchema();
  const tokenHash = hashPublicToken(token);
  const accounts = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReferralAccount" WHERE "activationTokenHash" = $1 LIMIT 1`,
    tokenHash,
  );
  return accounts[0] ?? null;
}

export async function getReferralAccountPreviewByToken(token: string) {
  const account = await getReferralAccountRowByToken(token);
  if (!account) return null;

  const expiresAt = toDate(account.activationExpiresAt);
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    throw new Error("This referral activation link has expired.");
  }

  const links = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT COUNT(*)::int AS "count", COALESCE(SUM("potentialCommission"), 0) AS "potentialCommission" FROM "ReferralLink" WHERE "accountId" = $1`,
    asString(account.id),
  );

  return {
    accountId: asString(account.id),
    customerName: asString(account.customerName),
    customerPhone: asString(account.customerPhone),
    customerPhoneMasked: maskPhone(asString(account.customerPhone)),
    status: asString(account.status),
    activationExpiresAt: expiresAt?.toISOString() || null,
    totals: {
      totalReferrals: Number(links[0]?.count || 0),
      potentialCommission: toNumber(links[0]?.potentialCommission),
    },
  };
}

export async function sendReferralAccountOtp(token: string) {
  const account = await getReferralAccountRowByToken(token);
  if (!account) throw new Error("Referral account not found.");

  const expiresAt = toDate(account.activationExpiresAt);
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    throw new Error("This referral activation link has expired.");
  }

  const normalizedPhone = normalizeKenyanPhone(asString(account.customerPhone));
  if (!normalizedPhone) {
    throw new Error("Referral account phone number is invalid.");
  }

  const otp = await createOtpCodeForChannel("phone", normalizedPhone);
  await sendOtpSms(otp.normalizedIdentifier, otp.code);
  return {
    phone: maskPhone(otp.normalizedIdentifier),
  };
}

async function ensureAgentIdentityForReferralAccount(account: Record<string, unknown>) {
  const customerName = asString(account.customerName);
  const normalizedPhone = normalizeKenyanPhone(asString(account.customerPhone));
  if (!normalizedPhone) {
    throw new Error("Referral account phone number is invalid.");
  }

  const existingUserId = cleanOptional(account.customerUserId);
  const resolution = await findOrCreateCustomerIdentityUser({
    customerName,
    customerPhone: normalizedPhone,
    customerEmail: null,
    currentUserId: existingUserId,
  });

  const userId = resolution.user.id;
  await updateSafeCustomerProfile(userId, {
    name: customerName,
    phone: normalizedPhone,
    whatsappNumber: normalizedPhone,
  }).catch(() => null);
  await updateSafeUserById(userId, {
    phone: normalizedPhone,
    phoneVerifiedAt: new Date(),
    lastLoginMethod: "africastalking_otp",
    isActive: true,
  }).catch(() => null);

  const user = await findSafeUserById(userId);
  const { firstName, lastName } = splitCustomerName(customerName);
  const existingAgentProfile = await prisma.agentProfile.findFirst({
    where: {
      OR: [
        { userId },
        { phone: normalizedPhone },
        ...(user?.email ? [{ email: { equals: user.email, mode: "insensitive" as const } }] : []),
      ],
    },
    select: {
      id: true,
      status: true,
      userId: true,
      referralCode: true,
    },
  });

  if (existingAgentProfile) {
    const nextStatus = ["rejected", "suspended"].includes(String(existingAgentProfile.status || "").toLowerCase())
      ? existingAgentProfile.status
      : "approved";

    await prisma.agentProfile.update({
      where: { id: existingAgentProfile.id },
      data: {
        userId,
        firstName,
        lastName,
        email: user?.email || null,
        phone: normalizedPhone,
        country: "Kenya",
        status: nextStatus || "approved",
      },
    });
  } else {
    const referralCode = await generateUniqueAgentReferralCode();
    await prisma.$transaction(async (tx) => {
      await tx.agentProfile.create({
        data: {
          userId,
          referralCode,
          firstName,
          lastName,
          email: user?.email || null,
          phone: normalizedPhone,
          country: "Kenya",
          status: "approved",
        },
      });
      await tx.agentActivityLog.create({
        data: {
          agentId: userId,
          action: "review_referral_linked",
          description: "Auto-linked from post-purchase review referral activation",
        },
      }).catch(() => null);
    });
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE "ReferralAccount"
      SET
        "customerUserId" = $2,
        "status" = CASE WHEN LOWER(COALESCE("status", '')) = 'pending_activation' THEN 'active' ELSE "status" END,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    asString(account.id),
    userId,
  );

  return {
    userId,
    phone: normalizedPhone,
  };
}

export async function verifyReferralAccountOtp(token: string, code: string) {
  const account = await getReferralAccountRowByToken(token);
  if (!account) throw new Error("Referral account not found.");

  const expiresAt = toDate(account.activationExpiresAt);
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    throw new Error("This referral activation link has expired.");
  }

  const normalizedPhone = normalizeKenyanPhone(asString(account.customerPhone));
  if (!normalizedPhone) {
    throw new Error("Referral account phone number is invalid.");
  }

  const verified = await verifyOtpCodeForChannel("phone", normalizedPhone, code, `/activate?token=${encodeURIComponent(token)}`);

  const linkedIdentity = await ensureAgentIdentityForReferralAccount({
    ...account,
    customerUserId: verified.user.id,
  });

  await prisma.$executeRawUnsafe(
    `
      UPDATE "ReferralAccount"
      SET
        "customerUserId" = COALESCE("customerUserId", $2),
        "status" = 'active',
        "activatedAt" = COALESCE("activatedAt", CURRENT_TIMESTAMP),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    asString(account.id),
    linkedIdentity.userId,
  );

  const verificationToken = createDirectVerifiedAuthToken({
    userId: linkedIdentity.userId,
    channel: "phone",
    identifier: linkedIdentity.phone,
    redirectTo: "/dashboard",
    requiresProfileCompletion: false,
  });

  const dashboard = await getReferralAccountDashboardByToken(token);
  if (!dashboard) throw new Error("Unable to load referral dashboard.");

  return {
    sessionToken: verificationToken,
    verificationToken,
    dashboard,
    phone: linkedIdentity.phone,
    redirectTo: "/dashboard",
  };
}

async function findReferralAccountByUserId(userId: string) {
  const user = await findSafeUserById(userId);
  const normalizedPhone = normalizeKenyanPhone(user?.phone || "");

  const accounts = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT *
      FROM "ReferralAccount"
      WHERE "customerUserId" = $1
        OR ($2 IS NOT NULL AND "customerPhone" = $2)
      ORDER BY CASE WHEN "customerUserId" = $1 THEN 0 ELSE 1 END, "updatedAt" DESC
      LIMIT 1
    `,
    userId,
    normalizedPhone || null,
  );

  const account = accounts[0] ?? null;
  if (!account) return null;

  if (cleanOptional(account.customerUserId) !== userId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ReferralAccount" SET "customerUserId" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
      asString(account.id),
      userId,
    );
    account.customerUserId = userId;
  }

  return account;
}

export async function getReferralAgentDashboardByUserId(userId: string) {
  await ensureReviewReferralSchema();
  await refreshReferralCommissionAvailability();

  const account = await findReferralAccountByUserId(userId);
  if (!account) {
    return {
      accountId: null,
      totals: {
        totalReferrals: 0,
        potentialCommission: 0,
        availableBalance: 0,
        pendingWithdrawalAmount: 0,
        paidWithdrawalAmount: 0,
      },
      referrals: [] as Array<{
        id: string;
        referralCode: string;
        productName: string;
        referredName: string | null;
        referredPhone: string;
        status: string;
        commissionStatus: string;
        potentialCommission: number;
        createdAt: string | null;
      }>,
      withdrawals: [] as Array<ReturnType<typeof presentWithdrawalRow>>,
    };
  }

  const links = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReferralLink" WHERE "accountId" = $1 ORDER BY "createdAt" DESC`,
    asString(account.id),
  );
  const [withdrawals, availableLinks] = await Promise.all([
    getReferralWithdrawalsForAccount(asString(account.id)),
    getAvailableReferralLinksForAccount(asString(account.id)),
  ]);

  return {
    accountId: asString(account.id),
    totals: {
      totalReferrals: links.length,
      potentialCommission: roundMoney(links.reduce((sum, row) => sum + toNumber(row.potentialCommission), 0)),
      availableBalance: roundMoney(availableLinks.reduce((sum, row) => sum + toNumber(row.potentialCommission), 0)),
      pendingWithdrawalAmount: roundMoney(
        withdrawals
          .filter((row) => ["pending", "approved", "held"].includes(String(row.status || "").toLowerCase()))
          .reduce((sum, row) => sum + toNumber(row.amount), 0),
      ),
      paidWithdrawalAmount: roundMoney(
        withdrawals
          .filter((row) => String(row.status || "").toLowerCase() === "paid")
          .reduce((sum, row) => sum + toNumber(row.amount), 0),
      ),
    },
    referrals: links.map((row) => ({
      id: asString(row.id),
      referralCode: asString(row.referralCode),
      productName: asString(row.productName),
      referredName: cleanOptional(row.referredName),
      referredPhone: maskPhone(asString(row.referredPhone)),
      status: asString(row.status),
      commissionStatus: asString(row.commissionStatus),
      potentialCommission: toNumber(row.potentialCommission),
      createdAt: toDate(row.createdAt)?.toISOString() || null,
    })),
    withdrawals: withdrawals.map(presentWithdrawalRow),
  };
}

export async function createReferralWithdrawalRequestForUser(userId: string, amountInput: number) {
  await ensureReviewReferralSchema();
  await refreshReferralCommissionAvailability();

  const account = await findReferralAccountByUserId(userId);
  if (!account) {
    throw new Error("No linked review referral account was found for this agent.");
  }

  const amount = roundMoney(Number(amountInput || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid withdrawal amount.");
  }
  if (amount < MIN_REFERRAL_WITHDRAWAL_AMOUNT) {
    throw new Error(`Minimum withdrawal amount is KES ${MIN_REFERRAL_WITHDRAWAL_AMOUNT}.`);
  }

  const availableLinks = await getAvailableReferralLinksForAccount(asString(account.id));
  const availableBalance = roundMoney(availableLinks.reduce((sum, row) => sum + toNumber(row.potentialCommission), 0));
  if (amount > availableBalance) {
    throw new Error(`Requested amount exceeds available balance of KES ${availableBalance}.`);
  }

  const phone = normalizeKenyanPhone(asString(account.customerPhone));
  if (!phone) {
    throw new Error("Referral account phone number is invalid.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const withdrawalId = `rwr_${randomBytes(10).toString("hex")}`;
    await tx.$executeRawUnsafe(
      `
        INSERT INTO "ReferralWithdrawalRequest" (
          "id", "accountId", "amount", "method", "phone", "status", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, 'M_PESA', $4, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      withdrawalId,
      asString(account.id),
      amount,
      phone,
    );

    let remaining = amount;
    for (const link of availableLinks) {
      if (remaining <= 0) break;
      const allocationAmount = roundMoney(Math.min(remaining, toNumber(link.potentialCommission)));
      if (allocationAmount <= 0) continue;
      await tx.$executeRawUnsafe(
        `
          INSERT INTO "ReferralWithdrawalAllocation" (
            "id", "withdrawalRequestId", "referralLinkId", "amount", "createdAt"
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `,
        `rwa_${randomBytes(10).toString("hex")}`,
        withdrawalId,
        asString(link.id),
        allocationAmount,
      );
      remaining = roundMoney(remaining - allocationAmount);
    }

    if (remaining > 0.009) {
      throw new Error("Unable to reserve enough commission lines for this withdrawal.");
    }

    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "ReferralWithdrawalRequest" WHERE "id" = $1 LIMIT 1`,
      withdrawalId,
    );
    return rows[0] ?? null;
  });

  if (!created) {
    throw new Error("Unable to create withdrawal request.");
  }

  return presentWithdrawalRow(created);
}

export async function createReferralWithdrawalRequest(
  input: z.infer<typeof createReferralWithdrawalSchema>,
  sessionToken: string,
) {
  await ensureReviewReferralSchema();
  await refreshReferralCommissionAvailability();

  const account = await getReferralAccountRowByToken(input.token);
  if (!account) throw new Error("Referral account not found.");

  const expiresAt = toDate(account.activationExpiresAt);
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    throw new Error("This referral activation link has expired.");
  }

  assertReferralActivation(sessionToken, account);

  const amount = roundMoney(Number(input.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid withdrawal amount.");
  }
  if (amount < MIN_REFERRAL_WITHDRAWAL_AMOUNT) {
    throw new Error(`Minimum withdrawal amount is KES ${MIN_REFERRAL_WITHDRAWAL_AMOUNT}.`);
  }

  const availableLinks = await getAvailableReferralLinksForAccount(asString(account.id));
  const availableBalance = roundMoney(availableLinks.reduce((sum, row) => sum + toNumber(row.potentialCommission), 0));

  if (amount > availableBalance) {
    throw new Error(`Requested amount exceeds available balance of KES ${availableBalance}.`);
  }

  const phone = normalizeKenyanPhone(asString(account.customerPhone));
  if (!phone) {
    throw new Error("Referral account phone number is invalid.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const withdrawalId = `rwr_${randomBytes(10).toString("hex")}`;
    await tx.$executeRawUnsafe(
      `
        INSERT INTO "ReferralWithdrawalRequest" (
          "id", "accountId", "amount", "method", "phone", "status", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, 'M_PESA', $4, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      withdrawalId,
      asString(account.id),
      amount,
      phone,
    );

    let remaining = amount;
    for (const link of availableLinks) {
      if (remaining <= 0) break;
      const allocationAmount = roundMoney(Math.min(remaining, toNumber(link.potentialCommission)));
      if (allocationAmount <= 0) continue;
      await tx.$executeRawUnsafe(
        `
          INSERT INTO "ReferralWithdrawalAllocation" (
            "id", "withdrawalRequestId", "referralLinkId", "amount", "createdAt"
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `,
        `rwa_${randomBytes(10).toString("hex")}`,
        withdrawalId,
        asString(link.id),
        allocationAmount,
      );
      remaining = roundMoney(remaining - allocationAmount);
    }

    if (remaining > 0.009) {
      throw new Error("Unable to reserve enough commission lines for this withdrawal.");
    }

    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "ReferralWithdrawalRequest" WHERE "id" = $1 LIMIT 1`,
      withdrawalId,
    );
    return rows[0] ?? null;
  });

  if (!created) {
    throw new Error("Unable to create withdrawal request.");
  }

  return presentWithdrawalRow(created);
}

export function validateReferralActivationSession(sessionToken: string, expectedPhone: string) {
  const payload = readVerifiedAuthToken(sessionToken);
  const normalizedExpectedPhone = normalizeKenyanPhone(expectedPhone);
  if (payload.channel !== "phone") {
    throw new Error("Invalid activation session.");
  }
  if (normalizeKenyanPhone(payload.identifier) !== normalizedExpectedPhone) {
    throw new Error("Activation session does not match this referral account.");
  }
  return payload;
}

export async function getReferralWithdrawalQueue() {
  await ensureReviewReferralSchema();
  await refreshReferralCommissionAvailability();

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        rwr.*,
        ra."customerName",
        ra."customerPhone",
        COALESCE(available."availableBalance", 0) AS "availableBalance",
        COALESCE(paid."paidWithdrawalAmount", 0) AS "paidWithdrawalAmount"
      FROM "ReferralWithdrawalRequest" rwr
      INNER JOIN "ReferralAccount" ra ON ra."id" = rwr."accountId"
      LEFT JOIN (
        SELECT
          rl."accountId",
          COALESCE(SUM(rl."potentialCommission"), 0) AS "availableBalance"
        FROM "ReferralLink" rl
        WHERE rl."commissionStatus" = 'COMMISSION_AVAILABLE'
          AND NOT EXISTS (
            SELECT 1
            FROM "ReferralWithdrawalAllocation" rwa
            INNER JOIN "ReferralWithdrawalRequest" reserved ON reserved."id" = rwa."withdrawalRequestId"
            WHERE rwa."referralLinkId" = rl."id"
              AND LOWER(reserved."status") IN ('pending', 'approved', 'held', 'paid')
          )
        GROUP BY rl."accountId"
      ) available ON available."accountId" = ra."id"
      LEFT JOIN (
        SELECT
          "accountId",
          COALESCE(SUM("amount"), 0) AS "paidWithdrawalAmount"
        FROM "ReferralWithdrawalRequest"
        WHERE LOWER("status") = 'paid'
        GROUP BY "accountId"
      ) paid ON paid."accountId" = ra."id"
      ORDER BY rwr."createdAt" DESC
    `,
  );

  return rows.map((row) => ({
    ...presentWithdrawalRow(row),
    accountId: asString(row.accountId),
    customerName: asString(row.customerName),
    customerPhone: maskPhone(asString(row.customerPhone)),
    availableBalance: toNumber(row.availableBalance),
    paidWithdrawalAmount: toNumber(row.paidWithdrawalAmount),
  }));
}

export async function updateReferralWithdrawalStatus(input: {
  id: string;
  status: "approved" | "paid" | "rejected" | "held";
  reference?: string | null;
  reason?: string | null;
}) {
  await ensureReviewReferralSchema();
  const normalizedReference = cleanOptional(input.reference);
  const normalizedReason = cleanOptional(input.reason);

  if (input.status === "paid" && !normalizedReference) {
    throw new Error("Payment reference is required before marking a withdrawal as paid.");
  }
  if (input.status === "rejected" && !normalizedReason) {
    throw new Error("Provide a reason before rejecting a withdrawal request.");
  }

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReferralWithdrawalRequest" WHERE "id" = $1 LIMIT 1`,
    input.id,
  );
  const existing = rows[0];
  if (!existing) {
    throw new Error("Withdrawal request not found.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextRows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        UPDATE "ReferralWithdrawalRequest"
        SET
          "status" = $2,
          "reference" = $3,
          "reason" = $4,
          "paidAt" = CASE WHEN $2 = 'paid' THEN CURRENT_TIMESTAMP ELSE "paidAt" END,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
        RETURNING *
      `,
      input.id,
      input.status,
      normalizedReference,
      normalizedReason,
    );

    if (input.status === "paid") {
      const allocations = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM "ReferralWithdrawalAllocation" WHERE "withdrawalRequestId" = $1`,
        input.id,
      );
      for (const allocation of allocations) {
        await tx.$executeRawUnsafe(
          `
            UPDATE "ReferralLink"
            SET
              "commissionStatus" = 'COMMISSION_PAID',
              "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $1
          `,
          asString(allocation.referralLinkId),
        );
      }
    }

    return nextRows[0] ?? null;
  });

  if (!updated) {
    throw new Error("Unable to update withdrawal request.");
  }

  return presentWithdrawalRow(updated);
}

export async function getReviewsReferralsAdminSummary() {
  await ensureReviewReferralSchema();
  await refreshReferralCommissionAvailability();
  const [reviewRows, referralRows, supportRows, withdrawalRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT
          COUNT(*) FILTER (WHERE "reviewStatus" = 'PENDING')::int AS "pendingInvitations",
          COUNT(*) FILTER (WHERE "sentAt" IS NOT NULL)::int AS "sentInvitations",
          COUNT(*) FILTER (WHERE "lastViewedAt" IS NOT NULL)::int AS "openedInvitations",
          COUNT(*) FILTER (WHERE "reviewStatus" = 'SUBMITTED')::int AS "submittedReviews",
          COUNT(*) FILTER (WHERE "reviewStatus" = 'PUBLISHED')::int AS "publishedReviews"
        FROM "ReviewInvitation"
      `,
    ),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT
          COUNT(*)::int AS "totalReferrals",
          COUNT(*) FILTER (WHERE "status" = 'LINK_CLICKED')::int AS "clickedReferrals",
          COALESCE(SUM("potentialCommission"), 0) AS "potentialCommission"
        FROM "ReferralLink"
      `,
    ),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT
          COUNT(*) FILTER (WHERE "status" = 'open')::int AS "openSupportRequests"
        FROM "ReviewSupportRequest"
      `,
    ),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT
          COUNT(*) FILTER (WHERE LOWER("status") IN ('pending', 'approved', 'held'))::int AS "pendingWithdrawals",
          COALESCE(SUM("amount") FILTER (WHERE LOWER("status") = 'paid'), 0) AS "paidWithdrawalAmount"
        FROM "ReferralWithdrawalRequest"
      `,
    ),
  ]);

  return {
    reviews: {
      pendingInvitations: Number(reviewRows[0]?.pendingInvitations || 0),
      sentInvitations: Number(reviewRows[0]?.sentInvitations || 0),
      openedInvitations: Number(reviewRows[0]?.openedInvitations || 0),
      submittedReviews: Number(reviewRows[0]?.submittedReviews || 0),
      publishedReviews: Number(reviewRows[0]?.publishedReviews || 0),
    },
    referrals: {
      totalReferrals: Number(referralRows[0]?.totalReferrals || 0),
      clickedReferrals: Number(referralRows[0]?.clickedReferrals || 0),
      potentialCommission: toNumber(referralRows[0]?.potentialCommission),
    },
    support: {
      openSupportRequests: Number(supportRows[0]?.openSupportRequests || 0),
    },
    withdrawals: {
      pendingWithdrawals: Number(withdrawalRows[0]?.pendingWithdrawals || 0),
      paidWithdrawalAmount: toNumber(withdrawalRows[0]?.paidWithdrawalAmount),
    },
  };
}

export async function getReviewInvitationOperations(args?: {
  status?: "due" | "sent" | "failed" | "all";
  limit?: number;
}) {
  await ensureReviewReferralSchema();
  const limit = Math.min(Math.max(Number(args?.limit || 80), 1), 250);
  const now = new Date();
  const status = args?.status || "all";

  let whereClause = "";
  if (status === "due") {
    whereClause = `
      WHERE "scheduledSendAt" IS NOT NULL
        AND "scheduledSendAt" <= $1
        AND "sentAt" IS NULL
        AND "usedAt" IS NULL
        AND "expiresAt" > $1
    `;
  } else if (status === "sent") {
    whereClause = `WHERE "sentAt" IS NOT NULL`;
  } else if (status === "failed") {
    whereClause = `WHERE "sentAt" IS NULL AND COALESCE("lastSendStatus", '') = 'FAILED'`;
  }

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT *
      FROM "ReviewInvitation"
      ${whereClause}
      ORDER BY COALESCE("scheduledSendAt", "createdAt") DESC
      LIMIT $2
    `,
    now,
    limit,
  );

  return rows.map(presentReviewInvitationAdminRow);
}

export async function getSubmittedReviewOperations(limit = 120) {
  await ensureReviewReferralSchema();
  const boundedLimit = Math.min(Math.max(Number(limit || 120), 1), 250);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        prs.*,
        ri."orderOrReceiptRef",
        ri."websiteOrderId",
        ri."orderId",
        ri."receiptId"
      FROM "ProductReviewSubmission" prs
      INNER JOIN "ReviewInvitation" ri ON ri."id" = prs."invitationId"
      ORDER BY prs."createdAt" DESC
      LIMIT $1
    `,
    boundedLimit,
  );

  return rows.map((row) => ({
    id: asString(row.id),
    invitationId: asString(row.invitationId),
    customerName: asString(row.customerName),
    customerPhoneRaw: asString(row.customerPhone),
    customerPhone: asString(row.customerPhone),
    customerTown: cleanOptional(row.customerTown),
    productId: asString(row.productId),
    productName: asString(row.productName),
    productUrl: buildProductUrl(slugifyProductName(asString(row.productName))),
    reviewTitle: cleanOptional(row.reviewTitle),
    reviewBody: asString(row.reviewBody),
    overallRating: Number(row.overallRating || 0),
    wouldRecommend: cleanOptional(row.wouldRecommend),
    published: Boolean(row.published),
    publishedAt: toDate(row.publishedAt)?.toISOString() || null,
    moderationStatus: asString(row.moderationStatus || "pending"),
    hasProblem: Boolean(row.hasProblem),
    websiteOrderId: cleanOptional(row.websiteOrderId),
    orderId: cleanOptional(row.orderId),
    receiptId: cleanOptional(row.receiptId),
    orderOrReceiptRef: cleanOptional(row.orderOrReceiptRef),
    orderUrl: buildReviewOrderUrl({
      websiteOrderId: cleanOptional(row.websiteOrderId),
      receiptId: cleanOptional(row.receiptId),
    }),
    createdAt: toDate(row.createdAt)?.toISOString() || null,
  })) satisfies SubmittedReviewAdminRow[];
}

export async function getPublishedReviewOperations(limit = 120) {
  await ensureReviewReferralSchema();
  const boundedLimit = Math.min(Math.max(Number(limit || 120), 1), 250);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        prs.*,
        ri."orderOrReceiptRef",
        ri."websiteOrderId",
        ri."orderId",
        ri."receiptId"
      FROM "ProductReviewSubmission" prs
      INNER JOIN "ReviewInvitation" ri ON ri."id" = prs."invitationId"
      WHERE prs."published" = TRUE
      ORDER BY prs."publishedAt" DESC NULLS LAST, prs."createdAt" DESC
      LIMIT $1
    `,
    boundedLimit,
  );

  return rows.map((row) => ({
    id: asString(row.id),
    invitationId: asString(row.invitationId),
    customerName: asString(row.customerName),
    customerPhoneRaw: asString(row.customerPhone),
    customerPhone: asString(row.customerPhone),
    customerTown: cleanOptional(row.customerTown),
    productId: asString(row.productId),
    productName: asString(row.productName),
    productUrl: buildProductUrl(slugifyProductName(asString(row.productName))),
    reviewTitle: cleanOptional(row.reviewTitle),
    reviewBody: asString(row.reviewBody),
    overallRating: Number(row.overallRating || 0),
    wouldRecommend: cleanOptional(row.wouldRecommend),
    published: Boolean(row.published),
    publishedAt: toDate(row.publishedAt)?.toISOString() || null,
    moderationStatus: asString(row.moderationStatus || "pending"),
    hasProblem: Boolean(row.hasProblem),
    websiteOrderId: cleanOptional(row.websiteOrderId),
    orderId: cleanOptional(row.orderId),
    receiptId: cleanOptional(row.receiptId),
    orderOrReceiptRef: cleanOptional(row.orderOrReceiptRef),
    orderUrl: buildReviewOrderUrl({
      websiteOrderId: cleanOptional(row.websiteOrderId),
      receiptId: cleanOptional(row.receiptId),
    }),
    createdAt: toDate(row.createdAt)?.toISOString() || null,
  })) satisfies SubmittedReviewAdminRow[];
}

export async function setReviewSubmissionPublished(reviewId: string, published: boolean) {
  await ensureReviewReferralSchema();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT "id", "invitationId" FROM "ProductReviewSubmission" WHERE "id" = $1 LIMIT 1`,
    reviewId,
  );
  const review = rows[0];
  if (!review) {
    throw new Error("Review not found.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        UPDATE "ProductReviewSubmission"
        SET
          "published" = $2,
          "publishedAt" = CASE WHEN $2 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END,
          "moderationStatus" = $3,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
      reviewId,
      published,
      published ? "published" : "pending",
    );

    await tx.$executeRawUnsafe(
      `
        UPDATE "ReviewInvitation"
        SET "reviewStatus" = $2, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
      asString(review.invitationId),
      published ? "PUBLISHED" : "SUBMITTED",
    );
  });
}

export async function deleteReviewSubmissionAdmin(reviewId: string) {
  await ensureReviewReferralSchema();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT "id", "invitationId" FROM "ProductReviewSubmission" WHERE "id" = $1 LIMIT 1`,
    reviewId,
  );
  const review = rows[0];
  if (!review) {
    throw new Error("Review not found.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        DELETE FROM "ReferralEvent"
        WHERE "referralLinkId" IN (
          SELECT "id" FROM "ReferralLink" WHERE "reviewId" = $1
        )
      `,
      reviewId,
    );
    await tx.$executeRawUnsafe(
      `
        DELETE FROM "ReferralWithdrawalAllocation"
        WHERE "referralLinkId" IN (
          SELECT "id" FROM "ReferralLink" WHERE "reviewId" = $1
        )
      `,
      reviewId,
    );
    await tx.$executeRawUnsafe(`DELETE FROM "ReferralLink" WHERE "reviewId" = $1`, reviewId);
    await tx.$executeRawUnsafe(`DELETE FROM "ReviewSupportRequest" WHERE "reviewId" = $1`, reviewId);
    await tx.$executeRawUnsafe(`DELETE FROM "ProductReviewSubmission" WHERE "id" = $1`, reviewId);
    await tx.$executeRawUnsafe(
      `
        UPDATE "ReviewInvitation"
        SET "reviewStatus" = CASE WHEN "sentAt" IS NOT NULL THEN 'SENT' ELSE 'PENDING' END,
            "usedAt" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
      asString(review.invitationId),
    );
  });
}

export async function getOpenReviewSupportOperations(limit = 120) {
  await ensureReviewReferralSchema();
  const boundedLimit = Math.min(Math.max(Number(limit || 120), 1), 250);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT *
      FROM "ReviewSupportRequest"
      WHERE LOWER("status") = 'open'
      ORDER BY "createdAt" DESC
      LIMIT $1
    `,
    boundedLimit,
  );

  return rows.map((row) => ({
    id: asString(row.id),
    reviewId: asString(row.reviewId),
    invitationId: asString(row.invitationId),
    customerName: asString(row.customerName),
    customerPhone: maskPhone(asString(row.customerPhone)),
    productName: asString(row.productName),
    issueDescription: asString(row.issueDescription),
    preferredContactNumber: cleanOptional(row.preferredContactNumber),
    bestTimeToContact: cleanOptional(row.bestTimeToContact),
    status: asString(row.status || "open"),
    createdAt: toDate(row.createdAt)?.toISOString() || null,
  }));
}

export async function retryReviewInvitationSend(invitationId: string) {
  await ensureReviewReferralSchema();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReviewInvitation" WHERE "id" = $1 LIMIT 1`,
    invitationId,
  );
  const row = rows[0];
  if (!row) {
    throw new Error("Review invitation not found.");
  }
  if (toDate(row.sentAt)) {
    throw new Error("This review invitation was already sent.");
  }
  if (toDate(row.expiresAt)?.getTime() && (toDate(row.expiresAt)?.getTime() || 0) <= Date.now()) {
    throw new Error("This review invitation has expired.");
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE "ReviewInvitation"
      SET "scheduledSendAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    invitationId,
  );

  const matched = await processReviewInvitationSend({ ...row, scheduledSendAt: new Date().toISOString() });

  const refreshedRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReviewInvitation" WHERE "id" = $1 LIMIT 1`,
    invitationId,
  );
  return {
    result: matched,
    invitation: refreshedRows[0] ? presentReviewInvitationAdminRow(refreshedRows[0]) : null,
  };
}

export async function sendAdminReviewInvitationChannelTest(
  invitationId: string,
  channel: ReviewInvitationTestChannel,
) {
  await ensureReviewReferralSchema();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReviewInvitation" WHERE "id" = $1 LIMIT 1`,
    invitationId,
  );
  const row = rows[0];
  if (!row) {
    throw new Error("Review invitation not found.");
  }

  const publicToken = await ensureInvitationPublicToken(row);
  const reviewUrl = `https://www.betech.co.ke/review/${publicToken}`;
  const smsMessage = buildReviewInvitationOutboundMessage({
    customerName: asString(row.customerName),
    productName: asString(row.productName),
    reviewUrl,
  });
  const whatsappMessage = buildReviewInvitationWhatsAppMessage({
    customerName: asString(row.customerName),
    productName: asString(row.productName),
    reviewUrl,
  });
  const emailPayload = buildReviewInvitationEmailPayload({
    customerName: asString(row.customerName),
    reviewUrl,
  });
  const phone = normalizeKenyanPhone(asString(row.customerPhone));
  const email = cleanOptional(row.customerEmail);

  if (channel === "sms") {
    if (!phone) {
      throw new Error("This invitation does not have a valid phone number for SMS.");
    }
    await sendTransactionalSms(phone, smsMessage);
    return {
      channel,
      recipient: phone,
      reviewUrl,
      preview: {
        title: "SMS test sent",
        message: smsMessage,
      },
    };
  }

  if (channel === "whatsapp") {
    if (!phone) {
      throw new Error("This invitation does not have a valid phone number for WhatsApp.");
    }
    if (hasWhatsAppConfig()) {
      await sendWhatsAppTextMessage({ to: phone, body: whatsappMessage, previewUrl: true });
    } else {
      const chatrace = await pushReceiptToChatrace({
        phoneE164: phone,
        customerName: asString(row.customerName),
        receiptNumber: cleanOptional(row.orderOrReceiptRef) || invitationId,
        amount: "0",
        currency: "KES",
        receiptLink: reviewUrl,
        receiptUrl: reviewUrl,
        tagName: REVIEW_INVITATION_CHATRACE_TAG,
        skipDefaultTags: true,
        extraFields: buildReviewInvitationWhatsAppChatraceFields({
          invitationId,
          customerName: asString(row.customerName),
          productName: asString(row.productName),
          reviewUrl,
          orderOrReceiptRef: cleanOptional(row.orderOrReceiptRef) || invitationId,
          whatsappMessage,
        }),
      });
      if (!chatrace.ok) {
        throw new Error(String(chatrace.debug?.error || "Unable to trigger WhatsApp review flow."));
      }
    }
    return {
      channel,
      recipient: phone,
      reviewUrl,
      preview: {
        title: "WhatsApp test triggered",
        message: whatsappMessage,
      },
    };
  }

  if (!email) {
    throw new Error("This invitation does not have an email address.");
  }
  await sendGeneralCustomerNotificationEmail({
    to: email,
    ...emailPayload,
  });
  return {
    channel,
    recipient: email,
    reviewUrl,
    preview: {
      title: "Email test sent",
      subject: emailPayload.subject,
      message: emailPayload.bodyText,
    },
  };
}

function buildReferralStageFromOrderStatus(status: string) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "CANCELLED") {
    return {
      referralStatus: "CANCELLED",
      commissionStatus: "REJECTED",
      eventType: "CANCELLED",
    };
  }
  if (normalized === "DELIVERED") {
    return {
      referralStatus: "SALE_CONFIRMED",
      commissionStatus: "COMMISSION_PENDING",
      eventType: "SALE_CONFIRMED",
    };
  }
  if (normalized === "PAYMENT_CONFIRMED") {
    return {
      referralStatus: "FULLY_PAID",
      commissionStatus: "COMMISSION_PENDING",
      eventType: "FULLY_PAID",
    };
  }
  return {
    referralStatus: "ORDER_CREATED",
    commissionStatus: "COMMISSION_PENDING",
    eventType: "ORDER_CREATED",
  };
}

function getReferralStatusWeight(status: string) {
  const normalized = String(status || "").toUpperCase();
  const weights: Record<string, number> = {
    LINK_CREATED: 1,
    LINK_CLICKED: 2,
    LEAD_CAPTURED: 3,
    ORDER_CREATED: 4,
    PARTIALLY_PAID: 5,
    FULLY_PAID: 6,
    SALE_CONFIRMED: 7,
    COMMISSION_PENDING: 8,
    COMMISSION_AVAILABLE: 9,
    WITHDRAWAL_REQUESTED: 10,
    PAID: 11,
    CANCELLED: 99,
    REJECTED: 98,
  };
  return weights[normalized] ?? 0;
}

function shouldAdvanceReferralStatus(current: string, next: string) {
  const currentNormalized = String(current || "").toUpperCase();
  const nextNormalized = String(next || "").toUpperCase();
  if (currentNormalized === "CANCELLED" || currentNormalized === "REJECTED") {
    return nextNormalized === currentNormalized;
  }
  return getReferralStatusWeight(nextNormalized) >= getReferralStatusWeight(currentNormalized);
}

async function insertReferralEvent(
  tx: Prisma.TransactionClient,
  referralLinkId: string,
  eventType: string,
  metadata: Record<string, unknown>,
) {
  await tx.$executeRawUnsafe(
    `
      INSERT INTO "ReferralEvent" ("id", "referralLinkId", "eventType", "metadata", "createdAt")
      VALUES ($1, $2, $3, $4::jsonb, CURRENT_TIMESTAMP)
    `,
    crypto.randomUUID(),
    referralLinkId,
    eventType,
    JSON.stringify(metadata),
  );
}

async function findMatchingReferralLinkForWebsiteOrder(orderId: string) {
  await ensureReviewReferralSchema();
  const order = await prisma.websiteOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      customerUser: {
        select: {
          id: true,
          attributionCodeUsed: true,
          referredByAgentId: true,
        },
      },
    },
  });
  if (!order) return null;

  const orderPhone = normalizeKenyanPhone(order.customerPhone);
  const attributionCode = String(
    order.attributionCodeUsed || order.customerUser?.attributionCodeUsed || readJsonObject(order.metadata).customerReferralCode || "",
  )
    .trim()
    .toUpperCase();
  const productIds = new Set(order.items.map((item) => String(item.productId || "").trim()).filter(Boolean));
  const orderCreatedAt = order.createdAt;

  if (!orderPhone && !attributionCode) {
    return { order, link: null };
  }

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT *
      FROM "ReferralLink"
      WHERE (
        ("referredPhone" = $1 AND $1 <> '')
        OR ("referralCode" = $2 AND $2 <> '')
      )
      ORDER BY "createdAt" DESC
    `,
    orderPhone || "",
    attributionCode || "",
  );

  const candidates = rows
    .filter((row) => {
      const createdAt = toDate(row.createdAt);
      if (!createdAt) return false;
      if (createdAt.getTime() > orderCreatedAt.getTime()) return false;
      const status = String(row.status || "").toUpperCase();
      return !["CANCELLED", "REJECTED"].includes(status);
    })
    .map((row) => {
      const exactCode = attributionCode && String(row.referralCode || "").toUpperCase() === attributionCode;
      const exactPhone = orderPhone && String(row.referredPhone || "") === orderPhone;
      const productMatch = productIds.has(String(row.productId || "").trim());
      const score = (exactCode ? 100 : 0) + (exactPhone ? 50 : 0) + (productMatch ? 25 : 0);
      return { row, score, exactCode, exactPhone, productMatch };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || toDate(right.row.createdAt)!.getTime() - toDate(left.row.createdAt)!.getTime());

  const best = candidates[0]?.row ?? null;
  return { order, link: best };
}

export async function refreshReferralCommissionAvailability() {
  await ensureReviewReferralSchema();
  await prisma.$executeRawUnsafe(
    `
      UPDATE "ReferralLink"
      SET
        "commissionStatus" = 'COMMISSION_AVAILABLE',
        "status" = CASE
          WHEN "status" = 'SALE_CONFIRMED' THEN 'COMMISSION_AVAILABLE'
          ELSE "status"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "commissionStatus" = 'COMMISSION_PENDING'
        AND "commissionAvailableAt" IS NOT NULL
        AND "commissionAvailableAt" <= CURRENT_TIMESTAMP
    `,
  );
}

export async function syncReferralLinkForWebsiteOrder(orderId: string) {
  await ensureReviewReferralSchema();
  await refreshReferralCommissionAvailability();

  const matched = await findMatchingReferralLinkForWebsiteOrder(orderId);
  if (!matched?.order || !matched.link) {
    return null;
  }

  const { order, link } = matched;
  const stage = buildReferralStageFromOrderStatus(String(order.status));
  const currentStatus = String(link.status || "LINK_CREATED");
  const nextStatus = shouldAdvanceReferralStatus(currentStatus, stage.referralStatus) ? stage.referralStatus : currentStatus;
  const policySnapshot = readJsonObject(link.policySnapshot);
  const holdingDays = Math.max(0, Number(policySnapshot.holdingDays ?? 7));
  const availableAt =
    stage.referralStatus === "SALE_CONFIRMED"
      ? new Date(Date.now() + holdingDays * 24 * 60 * 60 * 1000)
      : null;
  const saleAmount = roundMoney(Number(order.total || 0));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        UPDATE "ReferralLink"
        SET
          "status" = $2,
          "commissionStatus" = $3,
          "saleAmount" = $4,
          "matchedWebsiteOrderId" = $5,
          "matchedReceiptId" = COALESCE($6, "matchedReceiptId"),
          "convertedAt" = CASE
            WHEN $2 IN ('FULLY_PAID', 'SALE_CONFIRMED', 'COMMISSION_AVAILABLE') THEN COALESCE("convertedAt", CURRENT_TIMESTAMP)
            ELSE "convertedAt"
          END,
          "saleConfirmedAt" = CASE
            WHEN $2 = 'SALE_CONFIRMED' THEN COALESCE("saleConfirmedAt", CURRENT_TIMESTAMP)
            ELSE "saleConfirmedAt"
          END,
          "commissionAvailableAt" = COALESCE($7, "commissionAvailableAt"),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
      asString(link.id),
      nextStatus,
      availableAt && holdingDays === 0 ? "COMMISSION_AVAILABLE" : stage.commissionStatus,
      saleAmount,
      order.id,
      order.receiptId,
      availableAt,
    );

    await insertReferralEvent(tx, asString(link.id), stage.eventType, {
      websiteOrderId: order.id,
      orderRef: order.orderRef,
      orderStatus: order.status,
      total: saleAmount,
      receiptId: order.receiptId,
      attributionCodeUsed: order.attributionCodeUsed,
    });
  });

  await refreshReferralCommissionAvailability();

  return {
    referralCode: asString(link.referralCode),
    orderId: order.id,
    orderRef: order.orderRef,
    status: nextStatus,
  };
}
