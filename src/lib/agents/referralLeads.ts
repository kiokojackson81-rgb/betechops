import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizeKenyanPhone } from "@/lib/phone";
import { assertNoSelfReferralForAgent, claimReferralOwnershipLock, ensureReferralFraudSchema } from "@/lib/referralFraud";

const AGENT_REFERRAL_LEADS_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS "AgentReferralLead" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "productId" TEXT,
    "opsProductId" TEXT,
    "productName" TEXT NOT NULL,
    "productSlug" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "referralCode" TEXT,
    "referralUrl" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "linkedSaleId" TEXT,
    "linkedOrderId" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentReferralLead_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "AgentReferralLead_agentId_createdAt_idx" ON "AgentReferralLead"("agentId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AgentReferralLead_customerPhone_createdAt_idx" ON "AgentReferralLead"("customerPhone","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AgentReferralLead_status_createdAt_idx" ON "AgentReferralLead"("status","createdAt")`,
  `ALTER TABLE "AgentReferralLead" ADD COLUMN IF NOT EXISTS "productId" TEXT`,
  `ALTER TABLE "AgentReferralLead" ADD COLUMN IF NOT EXISTS "opsProductId" TEXT`,
  `ALTER TABLE "AgentReferralLead" ADD COLUMN IF NOT EXISTS "productSlug" TEXT`,
  `ALTER TABLE "AgentReferralLead" ADD COLUMN IF NOT EXISTS "customerName" TEXT`,
  `ALTER TABLE "AgentReferralLead" ADD COLUMN IF NOT EXISTS "referralCode" TEXT`,
  `ALTER TABLE "AgentReferralLead" ADD COLUMN IF NOT EXISTS "linkedSaleId" TEXT`,
  `ALTER TABLE "AgentReferralLead" ADD COLUMN IF NOT EXISTS "linkedOrderId" TEXT`,
  `ALTER TABLE "AgentReferralLead" ADD COLUMN IF NOT EXISTS "purchasedAt" TIMESTAMP(3)`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'AgentReferralLead_agentId_fkey'
        AND table_name = 'AgentReferralLead'
    ) THEN
      ALTER TABLE "AgentReferralLead"
        ADD CONSTRAINT "AgentReferralLead_agentId_fkey"
        FOREIGN KEY ("agentId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
] as const;

const globalAgentReferralLeadState = globalThis as typeof globalThis & {
  __agentReferralLeadSchemaReady?: Promise<void>;
};

export type AgentReferralLeadStatus = "PENDING" | "PURCHASED" | "CONVERTED" | "CANCELLED";
export type AgentReferralLeadChannel = "whatsapp" | "sms";

export type AgentReferralLeadRow = {
  id: string;
  agentId: string;
  productId: string | null;
  opsProductId: string | null;
  productName: string;
  productSlug: string | null;
  customerName: string | null;
  customerPhone: string;
  referralCode: string | null;
  referralUrl: string;
  channel: string;
  status: string;
  linkedSaleId: string | null;
  linkedOrderId: string | null;
  purchasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateAgentReferralLeadInput = {
  agentId: string;
  productId?: string | null;
  opsProductId?: string | null;
  productName: string;
  productSlug?: string | null;
  customerName?: string | null;
  customerPhone: string;
  referralCode?: string | null;
  referralUrl: string;
  channel: AgentReferralLeadChannel;
};

function mapAgentReferralLeadRow(row: Record<string, unknown>): AgentReferralLeadRow {
  return {
    id: String(row.id),
    agentId: String(row.agentId),
    productId: row.productId == null ? null : String(row.productId),
    opsProductId: row.opsProductId == null ? null : String(row.opsProductId),
    productName: String(row.productName || ""),
    productSlug: row.productSlug == null ? null : String(row.productSlug),
    customerName: row.customerName == null ? null : String(row.customerName),
    customerPhone: String(row.customerPhone || ""),
    referralCode: row.referralCode == null ? null : String(row.referralCode),
    referralUrl: String(row.referralUrl || ""),
    channel: String(row.channel || "whatsapp"),
    status: String(row.status || "PENDING"),
    linkedSaleId: row.linkedSaleId == null ? null : String(row.linkedSaleId),
    linkedOrderId: row.linkedOrderId == null ? null : String(row.linkedOrderId),
    purchasedAt: row.purchasedAt instanceof Date ? row.purchasedAt : row.purchasedAt ? new Date(String(row.purchasedAt)) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt)),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(String(row.updatedAt)),
  };
}

async function executeAgentReferralLeadSchema() {
  for (const statement of AGENT_REFERRAL_LEADS_SCHEMA_SQL) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export async function ensureAgentReferralLeadsSchema() {
  if (!globalAgentReferralLeadState.__agentReferralLeadSchemaReady) {
    globalAgentReferralLeadState.__agentReferralLeadSchemaReady = executeAgentReferralLeadSchema().catch((error) => {
      globalAgentReferralLeadState.__agentReferralLeadSchemaReady = undefined;
      throw error;
    });
  }

  await globalAgentReferralLeadState.__agentReferralLeadSchemaReady;
}

export async function createAgentReferralLead(input: CreateAgentReferralLeadInput) {
  await ensureAgentReferralLeadsSchema();
  await ensureReferralFraudSchema();

  const normalizedPhone = normalizeKenyanPhone(input.customerPhone);
  if (!normalizedPhone) {
    throw new Error("A valid Kenyan customer phone number is required.");
  }

  const normalizedCustomerName = String(input.customerName || "").trim() || null;
  const normalizedProductId = String(input.productId || "").trim() || null;
  const normalizedOpsProductId = String(input.opsProductId || "").trim() || null;
  const normalizedProductSlug = String(input.productSlug || "").trim() || null;
  const normalizedReferralCode = String(input.referralCode || "").trim() || null;
  const leadId = randomUUID();

  const duplicateRows = (await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM "AgentReferralLead"
      WHERE "agentId" = $1
        AND "customerPhone" = $2
        AND COALESCE("productId", '') = COALESCE($3, '')
        AND COALESCE("productSlug", '') = COALESCE($4, '')
        AND "status" = 'PENDING'
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
    input.agentId,
    normalizedPhone,
    normalizedProductId,
    normalizedProductSlug,
  )) as Record<string, unknown>[];

  if (duplicateRows.length) {
    const updatedRows = (await prisma.$queryRawUnsafe(
      `
        UPDATE "AgentReferralLead"
        SET
          "customerName" = $2,
          "opsProductId" = $3,
          "productName" = $4,
          "referralCode" = $5,
          "referralUrl" = $6,
          "channel" = $7,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
        RETURNING *
      `,
      String(duplicateRows[0].id),
      normalizedCustomerName,
      normalizedOpsProductId,
      input.productName,
      normalizedReferralCode,
      input.referralUrl,
      input.channel,
    )) as Record<string, unknown>[];

    return mapAgentReferralLeadRow(updatedRows[0]);
  }

  const createdRows = await prisma.$transaction(async (tx) => {
    await assertNoSelfReferralForAgent(tx, input.agentId, normalizedPhone);
    const ownershipLock = await claimReferralOwnershipLock(tx, {
      normalizedPhone,
      source: "agent_referral",
      ownerType: "agent",
      ownerUserId: input.agentId,
      customerName: normalizedCustomerName,
      productName: input.productName,
      agentLeadId: leadId,
      metadata: {
        productId: normalizedProductId,
        productSlug: normalizedProductSlug,
        referralCode: normalizedReferralCode,
        channel: input.channel,
      },
    });

    return (await tx.$queryRawUnsafe(
      `
        INSERT INTO "AgentReferralLead" (
          "id",
          "agentId",
          "productId",
          "opsProductId",
          "productName",
          "productSlug",
          "customerName",
          "customerPhone",
          "referralCode",
          "referralUrl",
          "channel",
          "ownershipLockId",
          "status",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *
      `,
      leadId,
      input.agentId,
      normalizedProductId,
      normalizedOpsProductId,
      input.productName,
      normalizedProductSlug,
      normalizedCustomerName,
      normalizedPhone,
      normalizedReferralCode,
      input.referralUrl,
      input.channel,
      ownershipLock.id,
    )) as Record<string, unknown>[];
  });

  return mapAgentReferralLeadRow(createdRows[0]);
}

export async function listAgentReferralLeadsByAgent(agentId: string) {
  await ensureAgentReferralLeadsSchema();
  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM "AgentReferralLead"
      WHERE "agentId" = $1
      ORDER BY "createdAt" DESC
    `,
    agentId,
  )) as Record<string, unknown>[];

  return rows.map(mapAgentReferralLeadRow);
}
