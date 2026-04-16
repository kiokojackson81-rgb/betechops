import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as { params?: Promise<{ id: string }> | { id: string } }).params;
  if (maybePromise && typeof (maybePromise as Promise<{ id: string }>).then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

export async function PATCH(req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;

  const { id } = await resolveParams(context);
  const body = await req.json().catch(() => ({}));
  const rawPaymentMethod = String(body?.paymentMethod ?? "").toUpperCase().trim();
  const paymentMethod =
    rawPaymentMethod === "CASH" ? PaymentMethod.CASH : rawPaymentMethod === "MPESA" ? PaymentMethod.MPESA : null;
  if (!paymentMethod) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }

  const actorId = (guard.session?.user as { id?: string } | undefined)?.id ?? null;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findUnique({
        where: { id },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              attendantId: true,
            },
          },
        },
      });
      if (!receipt) throw new Error("Receipt not found");

      const dataAttendantId =
        receipt.data && typeof receipt.data === "object"
          ? String((receipt.data as Record<string, unknown>).attendantId ?? "").trim() || null
          : null;
      const ownsReceipt =
        Boolean(actorId) &&
        (actorId === receipt.issuedById || actorId === receipt.order?.attendantId || actorId === dataAttendantId);
      if (guard.role === "ATTENDANT" && !ownsReceipt) {
        return null;
      }

      const nextData = {
        ...((receipt.data as Record<string, unknown> | null) ?? {}),
        paymentMethod,
      };
      const nextTotals = {
        ...((receipt.totals as Record<string, unknown> | null) ?? {}),
        paymentMethod,
      };

      const updatedReceipt = await tx.receipt.update({
        where: { id },
        data: {
          data: nextData,
          totals: nextTotals,
        },
      });

      const normalizedReceiptNumber = canonicalReceiptNumber(receipt.order?.orderNumber ?? "");
      if (normalizedReceiptNumber) {
        await tx.marketingReceipt.updateMany({
          where: { receiptNumber: normalizedReceiptNumber },
          data: { paymentMethod },
        });
        await tx.supportReceipt.updateMany({
          where: { receiptNumber: normalizedReceiptNumber },
          data: { paymentMethod },
        });
      }

      try {
        await tx.actionLog.create({
          data: {
            actorId: actorId ?? "system",
            entity: "Receipt",
            entityId: id,
            action: "UPDATE_PAYMENT_METHOD",
            before: {
              paymentMethod:
                receipt.data && typeof receipt.data === "object"
                  ? (receipt.data as Record<string, unknown>).paymentMethod ?? null
                  : null,
            },
            after: { paymentMethod },
          },
        });
      } catch {
        // best-effort audit log
      }

      return updatedReceipt;
    });

    if (!updated) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      receipt: updated,
      paymentMethod,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update payment method";
    if (message === "Receipt not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
