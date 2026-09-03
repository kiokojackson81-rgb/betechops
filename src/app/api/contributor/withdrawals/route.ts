import { noStoreJson } from "@/lib/api";
import {
  getContributorBalance,
  notifyProductContributorWithdrawal,
  requireProductContributor,
} from "@/lib/productContributor";
import { notifyAdminCriticalSms } from "@/lib/adminCriticalSms";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { z } from "zod";

const withdrawalInput = z.object({
  amountKes: z.coerce.number().int().min(1).max(100000),
});

export async function POST(req: Request) {
  const access = await requireProductContributor();
  if (!access.ok) return access.res;
  const parsed = withdrawalInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return noStoreJson(
      { error: "Enter a valid withdrawal amount." },
      { status: 400 },
    );
  const balance = await getContributorBalance(access.userId);
  if (parsed.data.amountKes > balance.availableKes) {
    return noStoreJson(
      {
        error: `Only KES ${balance.availableKes} is currently available for withdrawal.`,
      },
      { status: 400 },
    );
  }
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProductContributorWithdrawal" ("id", "contributorId", "amountKes") VALUES ($1, $2, $3)`,
    id,
    access.userId,
    parsed.data.amountKes,
  );
  void Promise.all([
    notifyProductContributorWithdrawal({
      contributorId: access.userId,
      withdrawalId: id,
      amountKes: parsed.data.amountKes,
      status: "PENDING",
    }),
    notifyAdminCriticalSms({
      eventType: "PRODUCT_CONTRIBUTOR_WITHDRAWAL_REQUESTED",
      entityId: id,
      title: "Product contributor withdrawal",
      details: [
        `Amount: KES ${parsed.data.amountKes.toLocaleString("en-KE")}`,
        "Contributor: Product contributor account",
      ],
      actionPath: "/admin/product-contributors/withdrawals",
    }),
  ]);
  return noStoreJson({ ok: true, id });
}
