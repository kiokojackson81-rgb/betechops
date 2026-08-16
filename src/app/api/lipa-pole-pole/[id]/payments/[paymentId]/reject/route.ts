import { z } from "zod";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { getSerializedLppAccountDetail, reviewLppPayment } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ id: string; paymentId: string }> };
const schema = z.object({ reason: z.string().trim().min(3).max(1000) });

export async function POST(request: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const { id, paymentId } = await context.params;

  try {
    await reviewLppPayment({
      lipaPolePoleId: id,
      paymentId,
      reviewedById: actorId,
      action: "REJECT",
      rejectionReason: parsed.data.reason,
    });
    return noStoreJson({ ok: true, ...(await getSerializedLppAccountDetail(id)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject payment.";
    const status = message.includes("NOT_FOUND") ? 404 : message === "LPP_PAYMENT_ALREADY_REVIEWED" ? 409 : 500;
    return noStoreJson({ error: message }, { status });
  }
}
