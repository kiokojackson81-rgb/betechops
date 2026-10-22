import { z } from "zod";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { updateLppPayment } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.coerce.number().positive(),
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

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId()) ?? undefined;
  if (!actorId) return noStoreJson({ error: "Unable to identify the administrator making this change." }, { status: 401 });
  try {
    await updateLppPayment({ lipaPolePoleId: id, paymentId, amount: parsed.data.amount, method: parsed.data.method, reference: parsed.data.reference, notes: parsed.data.notes, receivedAt, updatedById: actorId });
    return noStoreJson({ ok: true });
  } catch (error) { return noStoreJson({ error: error instanceof Error ? error.message : "Unable to update payment." }, { status: 400 }); }
}
