import { noStoreJson } from "@/lib/api";
import { requireProductContributorAdmin } from "@/lib/productContributor";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireProductContributorAdmin();
  if (!access.ok) return access.res;
  const withdrawals = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT w."id", w."amountKes", w."status", w."paymentReference", w."adminNote", w."requestedAt", w."processedAt",
            u."name" AS "contributorName", u."email" AS "contributorEmail"
     FROM "ProductContributorWithdrawal" w
     JOIN "User" u ON u."id" = w."contributorId"
     ORDER BY CASE w."status" WHEN 'PENDING' THEN 0 ELSE 1 END, w."requestedAt" DESC`,
  );
  return noStoreJson({ ok: true, withdrawals });
}
