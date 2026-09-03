import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  PRODUCT_CONTRIBUTOR_EMAIL,
  PRODUCT_UPLOAD_EARNING_KES,
} from "@/lib/productContributorConfig";
import { sendTransactionalSms } from "@/lib/africasTalking";

export {
  PRODUCT_CONTRIBUTOR_EMAIL,
  PRODUCT_UPLOAD_EARNING_KES,
} from "@/lib/productContributorConfig";

// This account is intentionally scoped to the product-contributor workspace.
export async function requireProductContributor() {
  const session = await auth();
  const user = session?.user as
    { id?: string; email?: string | null } | undefined;
  if (!user?.id) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (user.email?.trim().toLowerCase() !== PRODUCT_CONTRIBUTOR_EMAIL) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  await ensureProductContributorSchema();
  return { ok: true as const, userId: user.id, session };
}

export async function requireProductContributorAdmin() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (user.role !== "ADMIN" && user.role !== "SUPERVISOR") {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  await ensureProductContributorSchema();
  return { ok: true as const, userId: user.id, session };
}

// Deploys where Prisma migrations are temporarily deferred still get a safe,
// idempotent schema bootstrap. The matching SQL migration remains the source of truth.
export async function ensureProductContributorSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductContributorProduct" (
      "productId" TEXT PRIMARY KEY REFERENCES "Product"("id") ON DELETE RESTRICT,
      "contributorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
      "earningKes" INTEGER NOT NULL DEFAULT 5 CHECK ("earningKes" >= 0),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ProductContributorProduct_contributorId_createdAt_idx"
      ON "ProductContributorProduct" ("contributorId", "createdAt" DESC)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductContributorWithdrawal" (
      "id" TEXT PRIMARY KEY,
      "contributorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
      "amountKes" INTEGER NOT NULL CHECK ("amountKes" > 0),
      "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'PAID', 'REJECTED')),
      "paymentReference" TEXT,
      "adminNote" TEXT,
      "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "processedAt" TIMESTAMPTZ,
      "processedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ProductContributorWithdrawal_contributorId_status_idx"
      ON "ProductContributorWithdrawal" ("contributorId", "status", "requestedAt" DESC)
  `);
}

export type ContributorBalance = {
  productsCreated: number;
  totalEarnedKes: number;
  paidKes: number;
  pendingKes: number;
  availableKes: number;
};

function formatContributorKes(amount: number) {
  return `KES ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(amount)}`;
}

export async function notifyProductContributorWithdrawal(input: {
  contributorId: string;
  withdrawalId: string;
  amountKes: number;
  status: "PENDING" | "PAID" | "REJECTED";
  paymentReference?: string | null;
}) {
  const contributor = await prisma.user.findUnique({
    where: { id: input.contributorId },
    select: {
      name: true,
      phone: true,
      mobileMoneyPhoneNumber: true,
      notificationPhoneNumber: true,
    },
  });
  const phone =
    contributor?.notificationPhoneNumber ||
    contributor?.mobileMoneyPhoneNumber ||
    contributor?.phone;
  if (!phone) return { sent: false, reason: "missing_phone" as const };

  const name = contributor?.name || "Contributor";
  const statusMessage =
    input.status === "PENDING"
      ? "has been received and is awaiting review"
      : input.status === "PAID"
        ? `has been paid${input.paymentReference ? ` (Ref: ${input.paymentReference})` : ""}`
        : "was not approved";
  try {
    await sendTransactionalSms(
      phone,
      `Hello ${name}, your Betech product contributor withdrawal of ${formatContributorKes(input.amountKes)} ${statusMessage}. Request: ${input.withdrawalId}.`,
    );
    return { sent: true };
  } catch (error) {
    console.error("[product-contributor] withdrawal SMS failed", {
      withdrawalId: input.withdrawalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { sent: false, reason: "send_failed" as const };
  }
}

export async function getContributorBalance(
  contributorId: string,
): Promise<ContributorBalance> {
  await ensureProductContributorSchema();
  const [row] = await prisma.$queryRawUnsafe<
    Array<{
      productsCreated: number;
      totalEarnedKes: number;
      paidKes: number;
      pendingKes: number;
    }>
  >(
    `SELECT
      (SELECT COUNT(*)::int FROM "ProductContributorProduct" WHERE "contributorId" = $1) AS "productsCreated",
      COALESCE((SELECT SUM("earningKes") FROM "ProductContributorProduct" WHERE "contributorId" = $1), 0)::int AS "totalEarnedKes",
      COALESCE((SELECT SUM("amountKes") FROM "ProductContributorWithdrawal" WHERE "contributorId" = $1 AND "status" = 'PAID'), 0)::int AS "paidKes",
      COALESCE((SELECT SUM("amountKes") FROM "ProductContributorWithdrawal" WHERE "contributorId" = $1 AND "status" = 'PENDING'), 0)::int AS "pendingKes"`,
    contributorId,
  );
  const totalEarnedKes = Number(row?.totalEarnedKes ?? 0);
  const paidKes = Number(row?.paidKes ?? 0);
  const pendingKes = Number(row?.pendingKes ?? 0);
  return {
    productsCreated: Number(row?.productsCreated ?? 0),
    totalEarnedKes,
    paidKes,
    pendingKes,
    availableKes: Math.max(0, totalEarnedKes - paidKes - pendingKes),
  };
}
