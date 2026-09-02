import { noStoreJson } from "@/lib/api";
import { requireProductContributorAdmin } from "@/lib/productContributor";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const input = z.object({
  status: z.enum(["PAID", "REJECTED"]),
  paymentReference: z.string().trim().max(120).optional().nullable(),
  adminNote: z.string().trim().max(1000).optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireProductContributorAdmin();
  if (!access.ok) return access.res;
  const parsed = input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return noStoreJson({ error: "Invalid withdrawal update." }, { status: 400 });
  const { id } = await params;
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `UPDATE "ProductContributorWithdrawal"
     SET "status" = $1, "paymentReference" = $2, "adminNote" = $3, "processedAt" = NOW(), "processedById" = $4
     WHERE "id" = $5 AND "status" = 'PENDING'
     RETURNING "id", "status", "amountKes"`,
    parsed.data.status, parsed.data.paymentReference || null, parsed.data.adminNote || null, access.userId, id,
  );
  if (!rows[0]) return noStoreJson({ error: "Withdrawal was already processed or was not found." }, { status: 409 });
  return noStoreJson({ ok: true, withdrawal: rows[0] });
}
