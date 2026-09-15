import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { isReceiptWithinEditableWindow, receiptEditRestrictionMessage } from "@/lib/receiptEditAccess";
import { publishSummaryUpdate } from "@/lib/receiptSseBroker";
import { syncPosReceiptToCustomerAccount } from "@/lib/posCustomerAccountSync";
import { sendReceiptChannels } from "@/workers/receiptSender";
import { sendTransactionalSms } from "@/lib/africasTalking";

const EXTERNAL_PAYBILL_CHANNELS = new Set(["EQUITY_PAYBILL", "DTB_PAYBILL", "ABSA_PAYBILL"]);

const channelLabel = (channel: string) => ({
  EQUITY_PAYBILL: "Equity Paybill",
  DTB_PAYBILL: "DTB Paybill",
  ABSA_PAYBILL: "Absa Paybill",
}[channel] ?? channel);

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveParams(context: ParamsContext) {
  const params = context.params;
  return typeof (params as Promise<{ id: string }>).then === "function"
    ? await params as { id: string }
    : params as { id: string };
}

export async function POST(req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;

  const { id } = await resolveParams(context);
  const body = await req.json().catch(() => ({}));
  const paymentCollectionMethod = String(body?.paymentCollectionMethod ?? "").trim().toUpperCase();
  const paymentReference = String(body?.paymentReference ?? "").trim().slice(0, 120) || null;
  if (!EXTERNAL_PAYBILL_CHANNELS.has(paymentCollectionMethod)) {
    return NextResponse.json({ error: "Select an external Paybill channel to confirm payment" }, { status: 400 });
  }

  const actor = guard.session?.user as { id?: string; name?: string; email?: string } | undefined;
  const actorId = actor?.id ?? null;
  const actorName = actor?.name?.trim() || actor?.email?.trim() || "Betech staff";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findUnique({
        where: { id },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              attendantId: true,
              customerPhone: true,
              totalAmount: true,
              paidAmount: true,
              paymentStatus: true,
              metadata: true,
            },
          },
        },
      });
      if (!receipt?.order) throw new Error("Receipt not found");

      const receiptData =
        receipt.data && typeof receipt.data === "object"
          ? (receipt.data as Record<string, unknown>)
          : {};
      const dataAttendantId = String(receiptData.attendantId ?? "").trim() || null;
      const ownsReceipt = Boolean(actorId) && (
        actorId === receipt.issuedById ||
        actorId === receipt.order.attendantId ||
        actorId === dataAttendantId
      );
      if (guard.role === "ATTENDANT" && !ownsReceipt) return null;
      if (guard.role !== "ADMIN" && !isReceiptWithinEditableWindow(receipt.createdAt)) {
        throw new Error(receiptEditRestrictionMessage());
      }

      const totalAmount = Math.max(0, Number(receipt.order.totalAmount));
      const paidAmount = Math.max(0, Number(receipt.order.paidAmount));
      if (receipt.order.paymentStatus === "PAID" && paidAmount >= totalAmount) {
        return {
          receiptId: receipt.id,
          attendantId: receipt.order.attendantId,
          receiptNumber: receipt.receiptNumber ?? receipt.order.orderNumber,
          totalAmount,
          alreadyConfirmed: true,
        };
      }

      const confirmedAt = new Date().toISOString();
      const externalPayment = {
        collectionMethod: paymentCollectionMethod,
        paymentReference,
        confirmedAt,
        confirmedById: actorId,
        confirmedBy: actorName,
      };
      const nextData = {
        ...receiptData,
        paymentMethod: PaymentMethod.MPESA,
        paymentCollectionMethod,
        externalPayment,
      };
      const orderMetadata =
        receipt.order.metadata && typeof receipt.order.metadata === "object"
          ? (receipt.order.metadata as Record<string, unknown>)
          : {};
      const nextMetadata = {
        ...orderMetadata,
        paymentCollectionMethod,
        externalPayment,
      };

      await tx.receipt.update({
        where: { id: receipt.id },
        data: {
          data: nextData,
          totals: {
            ...((receipt.totals as Record<string, unknown> | null) ?? {}),
            paymentMethod: PaymentMethod.MPESA,
          },
        },
      });
      await tx.order.update({
        where: { id: receipt.order.id },
        data: {
          paidAmount: totalAmount,
          paymentStatus: "PAID",
          status: "COMPLETED",
          metadata: nextMetadata,
        },
      });

      const normalizedReceiptNumber = canonicalReceiptNumber(receipt.order.orderNumber);
      if (normalizedReceiptNumber) {
        await tx.marketingReceipt.updateMany({
          where: { receiptNumber: normalizedReceiptNumber },
          data: { paymentMethod: PaymentMethod.MPESA },
        });
        await tx.supportReceipt.updateMany({
          where: { receiptNumber: normalizedReceiptNumber },
          data: { paymentMethod: PaymentMethod.MPESA },
        });
      }

      try {
        await tx.actionLog.create({
          data: {
            actorId: actorId ?? "system",
            entity: "Receipt",
            entityId: receipt.id,
            action: "CONFIRM_EXTERNAL_PAYBILL_PAYMENT",
            before: {
              paidAmount,
              paymentStatus: receipt.order.paymentStatus,
              paymentCollectionMethod: receiptData.paymentCollectionMethod ?? null,
            },
            after: {
              paidAmount: totalAmount,
              paymentStatus: "PAID",
              paymentCollectionMethod,
              paymentReference,
              confirmedAt,
              confirmedBy: actorName,
            },
          },
        });
      } catch {
        // Receipt confirmation remains valid even when the best-effort audit log is unavailable.
      }

      return {
        receiptId: receipt.id,
        attendantId: receipt.order.attendantId,
        receiptNumber: receipt.receiptNumber ?? receipt.order.orderNumber,
        totalAmount,
        alreadyConfirmed: false,
      };
    });

    if (!result) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    publishSummaryUpdate({
      attendantId: result.attendantId ?? null,
      receiptId: result.receiptId,
      timestamp: new Date().toISOString(),
    });

    if (!result.alreadyConfirmed) {
      await syncPosReceiptToCustomerAccount(result.receiptId).catch((error) =>
        console.error("[external-payment] customer account sync failed", error),
      );
      await sendReceiptChannels(result.receiptId, [], {
        requestId: `external-paybill-confirmed-${result.receiptId}`,
      }).catch((error) => console.error("[external-payment] receipt notification failed", error));
      await sendTransactionalSms(
        "0722151083",
        `External payment confirmed. Receipt: ${result.receiptNumber}. Amount: KSh ${result.totalAmount.toLocaleString("en-KE")}. Method: ${channelLabel(paymentCollectionMethod)}. Confirmed by: ${actorName}.`,
      ).catch((error) => console.error("[external-payment] operations SMS failed", error));
    }

    return NextResponse.json({
      ok: true,
      receiptId: result.receiptId,
      alreadyConfirmed: result.alreadyConfirmed,
      paymentCollectionMethod,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to confirm external payment";
    if (message === "Receipt not found") return NextResponse.json({ error: message }, { status: 404 });
    if (message === receiptEditRestrictionMessage()) return NextResponse.json({ error: message }, { status: 403 });
    console.error("[external-payment] confirmation failed", error);
    return NextResponse.json({ error: "Unable to confirm external payment" }, { status: 500 });
  }
}
