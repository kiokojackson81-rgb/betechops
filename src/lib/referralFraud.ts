import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

const REFERRAL_FRAUD_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS "ReferralOwnershipLock" (
    "id" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerReferralAccountId" TEXT,
    "customerUserId" TEXT,
    "customerName" TEXT,
    "productName" TEXT,
    "agentLeadId" TEXT,
    "reviewId" TEXT,
    "referralLinkId" TEXT,
    "lockExpiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "overrideNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralOwnershipLock_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ReferralOwnershipLock_normalizedPhone_idx" ON "ReferralOwnershipLock"("normalizedPhone")`,
  `CREATE INDEX IF NOT EXISTS "ReferralOwnershipLock_status_lockExpiresAt_idx" ON "ReferralOwnershipLock"("status","lockExpiresAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralOwnershipLock_active_phone_key" ON "ReferralOwnershipLock"("normalizedPhone") WHERE "status" = 'active'`,
  `CREATE TABLE IF NOT EXISTS "ReferralFraudEvent" (
    "id" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorReferralAccountId" TEXT,
    "ownershipLockId" TEXT,
    "agentLeadId" TEXT,
    "reviewId" TEXT,
    "referralLinkId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralFraudEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ReferralFraudEvent_normalizedPhone_createdAt_idx" ON "ReferralFraudEvent"("normalizedPhone","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ReferralFraudEvent_eventType_createdAt_idx" ON "ReferralFraudEvent"("eventType","createdAt")`,
  `ALTER TABLE "AgentReferralLead" ADD COLUMN IF NOT EXISTS "ownershipLockId" TEXT`,
  `ALTER TABLE "ReferralLink" ADD COLUMN IF NOT EXISTS "ownershipLockId" TEXT`,
] as const;

const globalReferralFraudState = globalThis as typeof globalThis & {
  __referralFraudSchemaReady?: Promise<void>;
};

export const REFERRAL_LOCK_DAYS = 90;

export type OwnershipLockRecord = {
  id: string;
  normalizedPhone: string;
  status: string;
  source: string;
  ownerType: string;
  ownerUserId: string | null;
  ownerReferralAccountId: string | null;
  customerUserId: string | null;
  customerName: string | null;
  productName: string | null;
  agentLeadId: string | null;
  reviewId: string | null;
  referralLinkId: string | null;
  lockExpiresAt: Date | null;
  releasedAt: Date | null;
  overrideNote: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function asString(value: unknown) {
  return value == null ? "" : String(value);
}

function cleanOptional(value: unknown) {
  const cleaned = asString(value).trim();
  return cleaned || null;
}

function toDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function mapOwnershipLockRow(row: Record<string, unknown>): OwnershipLockRecord {
  return {
    id: asString(row.id),
    normalizedPhone: asString(row.normalizedPhone),
    status: asString(row.status || "active"),
    source: asString(row.source || ""),
    ownerType: asString(row.ownerType || ""),
    ownerUserId: cleanOptional(row.ownerUserId),
    ownerReferralAccountId: cleanOptional(row.ownerReferralAccountId),
    customerUserId: cleanOptional(row.customerUserId),
    customerName: cleanOptional(row.customerName),
    productName: cleanOptional(row.productName),
    agentLeadId: cleanOptional(row.agentLeadId),
    reviewId: cleanOptional(row.reviewId),
    referralLinkId: cleanOptional(row.referralLinkId),
    lockExpiresAt: toDate(row.lockExpiresAt),
    releasedAt: toDate(row.releasedAt),
    overrideNote: cleanOptional(row.overrideNote),
    metadata: (row.metadata as Prisma.JsonValue | null) ?? null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

async function executeReferralFraudSchema() {
  for (const statement of REFERRAL_FRAUD_SCHEMA_SQL) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export async function ensureReferralFraudSchema() {
  if (!globalReferralFraudState.__referralFraudSchemaReady) {
    globalReferralFraudState.__referralFraudSchemaReady = executeReferralFraudSchema().catch((error) => {
      globalReferralFraudState.__referralFraudSchemaReady = undefined;
      throw error;
    });
  }
  await globalReferralFraudState.__referralFraudSchemaReady;
}

export function getReferralLockExpiresAt(baseDate = new Date()) {
  return new Date(baseDate.getTime() + REFERRAL_LOCK_DAYS * 24 * 60 * 60 * 1000);
}

function formatAbsoluteDate(value: Date | null) {
  if (!value) return "an unknown date";
  try {
    return new Intl.DateTimeFormat("en-KE", { dateStyle: "long" }).format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

export async function recordReferralFraudEvent(
  tx: Prisma.TransactionClient,
  input: {
    normalizedPhone: string;
    eventType: string;
    source: string;
    actorUserId?: string | null;
    actorReferralAccountId?: string | null;
    ownershipLockId?: string | null;
    agentLeadId?: string | null;
    reviewId?: string | null;
    referralLinkId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.$executeRawUnsafe(
    `
      INSERT INTO "ReferralFraudEvent" (
        "id", "normalizedPhone", "eventType", "source", "actorUserId", "actorReferralAccountId",
        "ownershipLockId", "agentLeadId", "reviewId", "referralLinkId", "metadata", "createdAt"
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11::jsonb, CURRENT_TIMESTAMP
      )
    `,
    randomUUID(),
    input.normalizedPhone,
    input.eventType,
    input.source,
    cleanOptional(input.actorUserId),
    cleanOptional(input.actorReferralAccountId),
    cleanOptional(input.ownershipLockId),
    cleanOptional(input.agentLeadId),
    cleanOptional(input.reviewId),
    cleanOptional(input.referralLinkId),
    JSON.stringify(input.metadata ?? {}),
  );
}

export async function expireActiveReferralLocks(
  tx: Prisma.TransactionClient,
  normalizedPhone?: string | null,
) {
  if (normalizedPhone) {
    await tx.$executeRawUnsafe(
      `
        UPDATE "ReferralOwnershipLock"
        SET
          "status" = 'expired',
          "releasedAt" = COALESCE("releasedAt", CURRENT_TIMESTAMP),
          "overrideNote" = COALESCE("overrideNote", 'Automatically expired by system.'),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "normalizedPhone" = $1
          AND "status" = 'active'
          AND "lockExpiresAt" < CURRENT_TIMESTAMP
      `,
      normalizedPhone,
    );
    return;
  }

  await tx.$executeRawUnsafe(
    `
      UPDATE "ReferralOwnershipLock"
      SET
        "status" = 'expired',
        "releasedAt" = COALESCE("releasedAt", CURRENT_TIMESTAMP),
        "overrideNote" = COALESCE("overrideNote", 'Automatically expired by system.'),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "status" = 'active'
        AND "lockExpiresAt" < CURRENT_TIMESTAMP
    `,
  );
}

export async function getActiveReferralOwnershipLock(
  tx: Prisma.TransactionClient,
  normalizedPhone: string,
) {
  const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT *
      FROM "ReferralOwnershipLock"
      WHERE "normalizedPhone" = $1
        AND "status" = 'active'
        AND "lockExpiresAt" >= CURRENT_TIMESTAMP
      ORDER BY "createdAt" ASC
      LIMIT 1
    `,
    normalizedPhone,
  );
  return rows[0] ? mapOwnershipLockRow(rows[0]) : null;
}

function buildOwnershipLockConflictMessage(lock: OwnershipLockRecord) {
  return `This customer has already been referred and is locked until ${formatAbsoluteDate(lock.lockExpiresAt)}.`;
}

export async function assertNoSelfReferralForAgent(
  tx: Prisma.TransactionClient,
  agentUserId: string,
  referredPhone: string,
) {
  const normalizedPhone = normalizeKenyanPhone(referredPhone);
  if (!normalizedPhone) {
    throw new Error("A valid Kenyan customer phone number is required.");
  }

  const agent = await tx.user.findUnique({
    where: { id: agentUserId },
    select: {
      phone: true,
      whatsappNumber: true,
      agentProfile: { select: { phone: true, referralCode: true } },
    },
  });

  const agentPhones = new Set(
    [agent?.phone, agent?.whatsappNumber, agent?.agentProfile?.phone]
      .map((value) => normalizeKenyanPhone(value || ""))
      .filter(Boolean),
  );

  if (!agentPhones.has(normalizedPhone)) return;

  await recordReferralFraudEvent(tx, {
    normalizedPhone,
    eventType: "self_referral_blocked",
    source: "agent_referral",
    actorUserId: agentUserId,
    metadata: {
      reason: "referred_phone_matches_agent_identity",
      referralCode: agent?.agentProfile?.referralCode || null,
    } as Prisma.InputJsonValue,
  });
  throw new Error("Self-referrals are not allowed.");
}

export async function assertNoSelfReferralForReview(
  tx: Prisma.TransactionClient,
  input: {
    customerUserId?: string | null;
    referrerPhone?: string | null;
    referredPhone: string;
    referralAccountId?: string | null;
  },
) {
  const normalizedReferredPhone = normalizeKenyanPhone(input.referredPhone);
  if (!normalizedReferredPhone) {
    throw new Error("A valid Kenyan phone number is required for the referral.");
  }

  const candidates = new Set<string>();
  const normalizedReferrerPhone = normalizeKenyanPhone(input.referrerPhone || "");
  if (normalizedReferrerPhone) candidates.add(normalizedReferrerPhone);

  if (input.customerUserId) {
    const customer = await tx.user.findUnique({
      where: { id: input.customerUserId },
      select: { phone: true, whatsappNumber: true },
    });
    [customer?.phone, customer?.whatsappNumber]
      .map((value) => normalizeKenyanPhone(value || ""))
      .filter(Boolean)
      .forEach((value) => candidates.add(value));
  }

  if (!candidates.has(normalizedReferredPhone)) return;

  await recordReferralFraudEvent(tx, {
    normalizedPhone: normalizedReferredPhone,
    eventType: "self_referral_blocked",
    source: "post_review_referral",
    actorReferralAccountId: input.referralAccountId,
    metadata: {
      reason: "referred_phone_matches_review_customer_identity",
    } as Prisma.InputJsonValue,
  });
  throw new Error("Self-referrals are not allowed.");
}

export async function claimReferralOwnershipLock(
  tx: Prisma.TransactionClient,
  input: {
    normalizedPhone: string;
    source: string;
    ownerType: "agent" | "review_referral";
    ownerUserId?: string | null;
    ownerReferralAccountId?: string | null;
    customerUserId?: string | null;
    customerName?: string | null;
    productName?: string | null;
    agentLeadId?: string | null;
    reviewId?: string | null;
    referralLinkId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const normalizedPhone = normalizeKenyanPhone(input.normalizedPhone);
  if (!normalizedPhone) {
    throw new Error("A valid Kenyan customer phone number is required.");
  }

  await expireActiveReferralLocks(tx, normalizedPhone);
  const activeLock = await getActiveReferralOwnershipLock(tx, normalizedPhone);
  if (activeLock) {
    await recordReferralFraudEvent(tx, {
      normalizedPhone,
      eventType: "duplicate_referral_blocked",
      source: input.source,
      actorUserId: input.ownerUserId,
      actorReferralAccountId: input.ownerReferralAccountId,
      ownershipLockId: activeLock.id,
      agentLeadId: input.agentLeadId,
      reviewId: input.reviewId,
      referralLinkId: input.referralLinkId,
      metadata: {
        ownerType: activeLock.ownerType,
        ownerUserId: activeLock.ownerUserId,
        ownerReferralAccountId: activeLock.ownerReferralAccountId,
        lockExpiresAt: activeLock.lockExpiresAt?.toISOString() ?? null,
      } as Prisma.InputJsonValue,
    });
    throw new Error(buildOwnershipLockConflictMessage(activeLock));
  }

  const lockId = randomUUID();
  const lockExpiresAt = getReferralLockExpiresAt();
  await tx.$executeRawUnsafe(
    `
      INSERT INTO "ReferralOwnershipLock" (
        "id", "normalizedPhone", "status", "source", "ownerType", "ownerUserId", "ownerReferralAccountId",
        "customerUserId", "customerName", "productName", "agentLeadId", "reviewId", "referralLinkId",
        "lockExpiresAt", "metadata", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, 'active', $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `,
    lockId,
    normalizedPhone,
    input.source,
    input.ownerType,
    cleanOptional(input.ownerUserId),
    cleanOptional(input.ownerReferralAccountId),
    cleanOptional(input.customerUserId),
    cleanOptional(input.customerName),
    cleanOptional(input.productName),
    cleanOptional(input.agentLeadId),
    cleanOptional(input.reviewId),
    cleanOptional(input.referralLinkId),
    lockExpiresAt,
    JSON.stringify(input.metadata ?? {}),
  );

  await recordReferralFraudEvent(tx, {
    normalizedPhone,
    eventType: "ownership_lock_created",
    source: input.source,
    actorUserId: input.ownerUserId,
    actorReferralAccountId: input.ownerReferralAccountId,
    ownershipLockId: lockId,
    agentLeadId: input.agentLeadId,
    reviewId: input.reviewId,
    referralLinkId: input.referralLinkId,
    metadata: {
      lockExpiresAt: lockExpiresAt.toISOString(),
      ownerType: input.ownerType,
    } as Prisma.InputJsonValue,
  });

  return { id: lockId, normalizedPhone, lockExpiresAt };
}

export async function listReferralOwnershipLocks(status: "active" | "released" | "expired" | "all" = "active", limit = 150) {
  await ensureReferralFraudSchema();
  const boundedLimit = Math.min(Math.max(Number(limit || 150), 1), 300);
  const whereClause =
    status === "all"
      ? ""
      : `WHERE "status" = $1`;
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT *
      FROM "ReferralOwnershipLock"
      ${whereClause}
      ORDER BY "createdAt" DESC
      LIMIT $${status === "all" ? 1 : 2}
    `,
    ...(status === "all" ? [boundedLimit] : [status, boundedLimit]),
  );
  return rows.map(mapOwnershipLockRow);
}

export async function releaseReferralOwnershipLock(input: {
  lockId: string;
  note: string;
  adminUserId?: string | null;
}) {
  await ensureReferralFraudSchema();
  const lockRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReferralOwnershipLock" WHERE "id" = $1 LIMIT 1`,
    input.lockId,
  );
  const row = lockRows[0];
  if (!row) {
    throw new Error("Referral ownership lock not found.");
  }
  const lock = mapOwnershipLockRow(row);
  if (lock.status !== "active") {
    throw new Error("Only active referral locks can be released.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        UPDATE "ReferralOwnershipLock"
        SET
          "status" = 'released',
          "releasedAt" = CURRENT_TIMESTAMP,
          "overrideNote" = $2,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
      input.lockId,
      input.note.trim(),
    );
    await recordReferralFraudEvent(tx, {
      normalizedPhone: lock.normalizedPhone,
      eventType: "ownership_lock_released",
      source: "admin_override",
      actorUserId: input.adminUserId,
      ownershipLockId: input.lockId,
      agentLeadId: lock.agentLeadId,
      reviewId: lock.reviewId,
      referralLinkId: lock.referralLinkId,
      metadata: {
        note: input.note.trim(),
        previousOwnerType: lock.ownerType,
        ownerUserId: lock.ownerUserId,
        ownerReferralAccountId: lock.ownerReferralAccountId,
      } as Prisma.InputJsonValue,
    });
  });

  const refreshedRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "ReferralOwnershipLock" WHERE "id" = $1 LIMIT 1`,
    input.lockId,
  );
  return refreshedRows[0] ? mapOwnershipLockRow(refreshedRows[0]) : null;
}
