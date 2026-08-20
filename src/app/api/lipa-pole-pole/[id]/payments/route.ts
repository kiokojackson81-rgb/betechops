import { z } from "zod";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { getLppAccountSummary, recordLppPayment } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as { params?: Promise<{ id: string }> | { id: string } }).params;
  if (maybePromise && typeof (maybePromise as Promise<{ id: string }>).then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

const paymentSchema = z.object({
  amount: z.union([z.coerce.number().positive(), z.string().trim().min(1)]),
  method: z.enum(["MPESA", "CASH", "BANK", "CARD", "OTHER"]),
  reference: z.string().trim().min(1).max(255).optional().nullable(),
  receivedById: z.string().trim().min(1).optional().nullable(),
  receivedAt: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  allowOverpaymentOverride: z.coerce.boolean().optional(),
});

function mapErrorStatus(message: string) {
  if (["INVALID_PAYMENT_AMOUNT", "INVALID_DATE", "INVALID_MPESA_REFERENCE", "PAYMENT_REFERENCE_REQUIRED", "PAYMENT_DATE_IN_FUTURE", "LPP_OVERPAYMENT_NOT_ALLOWED"].includes(message)) return 400;
  if (message === "LPP_NOT_FOUND") return 404;
  if (message === "LPP_NOT_ACCEPTING_PAYMENTS") return 409;
  if (
    message.includes("Unique constraint failed") ||
    message.includes("duplicate key") ||
    message.includes("LipaPolePolePayment_reference_key") ||
    message.includes("LipaPolePolePayment_lipaPolePoleId_reference_key")
  ) return 409;
  return 500;
}

export async function POST(req: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());
  const { id } = await resolveParams(context);

  try {
    const result = await recordLppPayment({
      lipaPolePoleId: id,
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: parsed.data.reference ?? null,
      receivedById: actorId,
      receivedAt: parsed.data.receivedAt ?? null,
      notes: parsed.data.notes ?? null,
      allowOverpaymentOverride:
        auth.role === "ADMIN" &&
        (parsed.data.allowOverpaymentOverride ?? false),
    });

    const summary = await getLppAccountSummary(id);
    return noStoreJson({
      ok: true,
      paymentId: result.paymentId,
      account: summary.lpp,
      payments: summary.payments,
      summary: summary.summary,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record LPP payment";
    const publicMessage =
      message === "DUPLICATE_PAYMENT_REFERENCE"
        ? "This payment reference has already been used on another Lipa Pole Pole payment."
        : message === "INVALID_MPESA_REFERENCE"
          ? "Enter the valid 10-character M-Pesa transaction code, for example UHG3K3STB0."
          : message === "PAYMENT_REFERENCE_REQUIRED"
            ? "A transaction reference is required for non-cash payments."
            : message === "PAYMENT_DATE_IN_FUTURE"
              ? "The payment date cannot be in the future."
              : message;
    return noStoreJson({ error: publicMessage }, { status: mapErrorStatus(message) });
  }
}
