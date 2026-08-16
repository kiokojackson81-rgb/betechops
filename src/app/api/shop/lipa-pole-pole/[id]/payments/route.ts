import { z } from "zod";
import { auth } from "@/lib/auth";
import { noStoreJson } from "@/lib/api";
import { getSerializedLppAccountDetail, recordLppPayment } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(["MPESA", "CASH", "BANK", "CARD", "OTHER"]),
  reference: z.string().trim().max(255).optional().or(z.literal("")).nullable(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")).nullable(),
});

type ParamsContext = { params: Promise<{ id: string }> };

function normalizeOptional(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

export async function POST(request: Request, context: ParamsContext) {
  const session = await auth();
  const user = session?.user as { id?: string | null } | undefined;
  if (!user?.id) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const detail = await getSerializedLppAccountDetail(id).catch(() => null);
  if (!detail) {
    return noStoreJson({ error: "LPP_NOT_FOUND" }, { status: 404 });
  }
  if (detail.account.customerId !== user.id) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.method !== "CASH" && !normalizeOptional(parsed.data.reference)) {
    return noStoreJson({ error: "Reference is required for non-cash payments." }, { status: 400 });
  }

  try {
    const payment = await recordLppPayment({
      lipaPolePoleId: id,
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: normalizeOptional(parsed.data.reference),
      receivedById: null,
      notes: normalizeOptional(parsed.data.notes) || "Submitted from customer portal.",
      status: "PENDING",
    });

    return noStoreJson({ ok: true, payment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record payment.";
    const status =
      message === "LPP_NOT_FOUND"
        ? 404
        : ["INVALID_PAYMENT_AMOUNT", "LPP_OVERPAYMENT_NOT_ALLOWED"].includes(message)
          ? 400
          : message === "DUPLICATE_PAYMENT_REFERENCE"
            ? 409
          : message === "LPP_NOT_ACCEPTING_PAYMENTS"
            ? 409
            : 500;
    return noStoreJson({
      error: message === "DUPLICATE_PAYMENT_REFERENCE"
        ? "This M-Pesa transaction code has already been submitted. Please check the code and try again."
        : message,
    }, { status });
  }
}
