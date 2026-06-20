import { prisma } from "@/lib/prisma";

export const REFERRAL_COOKIE_NAME = "betech_ref";
const REFERRAL_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

const ATTRIBUTION_SCHEMA_SQL = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByAgentId" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "attributionCodeUsed" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredAt" TIMESTAMP(3)`,
  `CREATE INDEX IF NOT EXISTS "User_referredByAgentId_idx" ON "User"("referredByAgentId")`,
  `ALTER TABLE "WebsiteOrder" ADD COLUMN IF NOT EXISTS "referredByAgentId" TEXT`,
  `ALTER TABLE "WebsiteOrder" ADD COLUMN IF NOT EXISTS "attributionCodeUsed" TEXT`,
  `CREATE INDEX IF NOT EXISTS "WebsiteOrder_referredByAgentId_createdAt_idx" ON "WebsiteOrder"("referredByAgentId", "createdAt")`,
] as const;

const globalAttributionSchema = globalThis as typeof globalThis & {
  __betechAttributionSchemaReady?: Promise<void>;
};

export type ResolvedReferralAttribution = {
  referralCode: string;
  agentUserId: string;
  agentName: string | null;
  agentEmail: string | null;
};

export function normalizeReferralCode(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || "";
}

export function getReferralCookieMaxAge() {
  return REFERRAL_COOKIE_TTL_SECONDS;
}

export async function ensureAttributionSchema() {
  if (!globalAttributionSchema.__betechAttributionSchemaReady) {
    globalAttributionSchema.__betechAttributionSchemaReady = (async () => {
      for (const statement of ATTRIBUTION_SCHEMA_SQL) {
        await prisma.$executeRawUnsafe(statement);
      }
    })().catch((error) => {
      globalAttributionSchema.__betechAttributionSchemaReady = undefined;
      throw error;
    });
  }

  return globalAttributionSchema.__betechAttributionSchemaReady;
}

export async function resolveReferralAttribution(referralCode?: string | null): Promise<ResolvedReferralAttribution | null> {
  const normalized = normalizeReferralCode(referralCode);
  if (!normalized) return null;

  const profile = await prisma.agentProfile.findUnique({
    where: { referralCode: normalized },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!profile?.user?.id) return null;

  return {
    referralCode: normalized,
    agentUserId: profile.user.id,
    agentName:
      profile.user.name ??
      ([profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || null),
    agentEmail: profile.user.email ?? profile.email ?? null,
  };
}

export async function applyReferralAttributionToUser(userId: string, referralCode?: string | null) {
  const resolved = await resolveReferralAttribution(referralCode);
  if (!resolved) return null;

  await ensureAttributionSchema();

  await prisma.$executeRawUnsafe(
    `
      UPDATE "User"
      SET
        "referredByAgentId" = COALESCE("referredByAgentId", $2),
        "attributionCodeUsed" = COALESCE("attributionCodeUsed", $3),
        "referredAt" = COALESCE("referredAt", NOW()),
        "updatedAt" = NOW()
      WHERE id = $1
    `,
    userId,
    resolved.agentUserId,
    resolved.referralCode,
  );

  return resolved;
}
