import { z } from "zod";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { getLppAccountSummary, reverseLppPayment } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

type ParamsContext =
  | { params: { id: string; paymentId: string } }
  | { params: Promise<{ id: string; paymentId: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string; paymentId: string }> {
  const maybePromise = (context as { params?: Promise<{ id: string; paymentId: string }> | { id: string; paymentId: string } }).params;
  if (maybePromise && typeof (maybePromise as Promise<{ id: string; paymentId: string }>).then === "function") {
    return maybePromise as Promise<{ id: string; paymentId: string }>;
  }
  return Promise.resolve((context as { params: { id: string; paymentId: string } }).params);
}

const reverseSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  reversedById: z.string().trim().min(1).optional().nullable(),
  reversedAt: z.string().trim().min(1).optional().nullable(),
  allowConvertedCorrection: z.coerce.boolean().optional(),
});

function mapErrorStatus(message: string) {
  if (["REVERSAL_REASON_REQUIRED", "INVALID_DATE"].includes(message)) return 400;
  if (message === "LPP_NOT_FOUND" || message === "LPP_PAYMENT_NOT_FOUND") return 404;
  if (
    [
      "LPP_PAYMENT_NOT_REVERSIBLE",
      "LPP_CONVERTED_PAYMENT_REVERSAL_REQUIRES_FINANCIAL_CORRECTION",
    ].includes(message)
  ) return 409;
  return 500;
}

export async function POST(req: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = reverseSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());
  const { id, paymentId } = await resolveParams(context);

  try {
    const result = await reverseLppPayment({
      lipaPolePoleId: id,
      paymentId,
      reversedById: parsed.data.reversedById ?? actorId,
      reversedAt: parsed.data.reversedAt ?? null,
      reason: parsed.data.reason,
      allowConvertedCorrection: parsed.data.allowConvertedCorrection ?? false,
    });

    const summary = await getLppAccountSummary(id);
    return noStoreJson({
      ok: true,
      reversedPaymentId: result.reversedPaymentId,
      account: summary.lpp,
      payments: summary.payments,
      summary: summary.summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reverse LPP payment";
    return noStoreJson({ error: message }, { status: mapErrorStatus(message) });
  }
}
