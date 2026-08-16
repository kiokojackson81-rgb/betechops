import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { getSerializedLppAccountDetail, reviewLppPayment } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ id: string; paymentId: string }> };

export async function POST(_request: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;
  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const { id, paymentId } = await context.params;

  try {
    await reviewLppPayment({ lipaPolePoleId: id, paymentId, reviewedById: actorId, action: "VERIFY" });
    return noStoreJson({ ok: true, ...(await getSerializedLppAccountDetail(id)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify payment.";
    const status = message.includes("NOT_FOUND") ? 404 : message === "LPP_OVERPAYMENT_NOT_ALLOWED" ? 400 : message === "LPP_PAYMENT_ALREADY_REVIEWED" ? 409 : 500;
    return noStoreJson({ error: message }, { status });
  }
}
