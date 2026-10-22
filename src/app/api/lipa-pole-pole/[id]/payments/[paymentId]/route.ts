import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  method: z.enum(["MPESA", "CASH", "BANK", "CARD", "OTHER"]),
  reference: z.string().trim().max(255).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  receivedAt: z.string().datetime(),
});

type Context = { params: Promise<{ id: string; paymentId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const { id, paymentId } = await params;
  const receivedAt = new Date(parsed.data.receivedAt);
  if (receivedAt.getTime() > Date.now() + 5 * 60 * 1000) return noStoreJson({ error: "The payment date cannot be in the future." }, { status: 400 });

  const before = await prisma.$queryRaw<Array<{ id: string; amount: Prisma.Decimal; method: string; reference: string | null; notes: string | null; receivedAt: Date; status: string }>>(Prisma.sql`
    SELECT "id", "amount", "method"::text AS "method", "reference", "notes", "receivedAt", "status"::text AS "status"
    FROM "LipaPolePolePayment" WHERE "id" = ${paymentId} AND "lipaPolePoleId" = ${id} LIMIT 1
  `);
  if (!before[0]) return noStoreJson({ error: "Payment not found." }, { status: 404 });
  if (before[0].status === "REVERSED") return noStoreJson({ error: "A reversed payment cannot be edited." }, { status: 409 });
  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId()) ?? undefined;

  await prisma.$transaction([
    prisma.$executeRaw(Prisma.sql`
      UPDATE "LipaPolePolePayment" SET "method" = ${parsed.data.method}::"LipaPolePolePaymentMethod", "reference" = ${parsed.data.reference || null}, "notes" = ${parsed.data.notes || null}, "receivedAt" = ${receivedAt}
      WHERE "id" = ${paymentId} AND "lipaPolePoleId" = ${id}
    `),
    prisma.actionLog.create({ data: {
      actorId, entity: "LipaPolePole", entityId: id, action: "PAYMENT_DETAILS_EDITED",
      before: { paymentId, amount: before[0].amount.toString(), method: before[0].method, reference: before[0].reference, notes: before[0].notes, receivedAt: before[0].receivedAt.toISOString() },
      after: { paymentId, method: parsed.data.method, reference: parsed.data.reference || null, notes: parsed.data.notes || null, receivedAt: receivedAt.toISOString() },
    }}),
  ]);
  return noStoreJson({ ok: true });
}
