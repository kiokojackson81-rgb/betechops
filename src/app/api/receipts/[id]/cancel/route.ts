import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import {
  cleanupMarketingReceipts,
  cleanupSupportReceipts,
} from "@/lib/marketingReceiptCleanup";
import { recomputeSupportCommissionLedger } from "@/lib/supportCommission";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { syncPosReceiptToCustomerAccount } from "@/lib/posCustomerAccountSync";
import { buildReceiptProjectFlow, readReceiptProjectFlow } from "@/lib/receiptProjects";
import { publishSummaryUpdate } from "@/lib/receiptSseBroker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cancellationReasonCodes = [
  "CUSTOMER_CHANGED_MIND",
  "DUPLICATE_ORDER",
  "ORDER_DETAILS_ERROR",
  "PRICING_ERROR",
  "OUT_OF_STOCK",
  "SUPPLIER_UNAVAILABLE",
  "PAYMENT_FAILED",
  "PAYMENT_NOT_COMPLETED",
  "DELIVERY_NOT_AVAILABLE",
  "CUSTOMER_UNREACHABLE",
  "ORDER_REPLACED",
  "SUSPECTED_FRAUD",
  "TEST_OR_TRAINING",
  "OTHER",
] as const;

const schema = z.object({
  reasonCode: z.enum(cancellationReasonCodes).optional(),
  reason: z.string().trim().max(500).optional(),
  refundRequired: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.reasonCode === "OTHER" && !value.reason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "Enter the cancellation reason." });
  }
});
type ParamsContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(request: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.res;
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid cancellation request." },
      { status: 400 },
    );
  const actorId = String(
    (guard.session?.user as { id?: string } | undefined)?.id || "system",
  );

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: { order: { include: { items: { select: { id: true } } } } },
  });
  if (!receipt?.order)
    return NextResponse.json(
      { error: "Receipt or linked order was not found." },
      { status: 404 },
    );
  if (receipt.order.status === "CANCELED")
    return NextResponse.json(
      { error: "This order is already cancelled." },
      { status: 409 },
    );

  const previous = {
    status: receipt.order.status,
    paymentStatus: receipt.order.paymentStatus,
    paidAmount: receipt.order.paidAmount,
    totalAmount: receipt.order.totalAmount,
  };
  const refundRequired = Boolean(parsed.data.refundRequired) && Number(receipt.order.paidAmount) > 0;
  const baseData =
    receipt.data &&
    typeof receipt.data === "object" &&
    !Array.isArray(receipt.data)
      ? (receipt.data as Record<string, unknown>)
      : {};
  const existingPod =
    baseData.podDelivery &&
    typeof baseData.podDelivery === "object" &&
    !Array.isArray(baseData.podDelivery)
      ? (baseData.podDelivery as Record<string, unknown>)
      : null;
  const existingProjectFlow = readReceiptProjectFlow(baseData.projectFlow);
  const isProjectReceipt =
    Boolean(existingProjectFlow) ||
    String(baseData.customerType || "").trim().toLowerCase() === "project";
  const cancelledAt = new Date().toISOString();
  const cancelledProjectFlow = isProjectReceipt
    ? {
        ...buildReceiptProjectFlow({
          existing: existingProjectFlow as unknown as Record<string, unknown> | null,
          stage: "CANCELLED",
          projectValue: Number(receipt.order.totalAmount || existingProjectFlow?.projectValue || 0),
          depositPaidAmount: 0,
          balancePaidAmount: 0,
          amountPaidTotal: 0,
        }),
        cancelledAt,
        cancelledById: actorId,
        cancellationReason: parsed.data.reason || null,
      }
    : null;

  await prisma.$transaction(async (tx) => {
    await cleanupMarketingReceipts(tx, receipt.order!.orderNumber, receipt.id);
    await cleanupSupportReceipts(tx, receipt.order!.orderNumber, receipt.id);
    const itemIds = receipt.order!.items.map((item) => item.id);
    if (itemIds.length)
      await tx.commissionEarning.deleteMany({
        where: { orderItemId: { in: itemIds } },
      });
    await tx.commissionRecord.deleteMany({
      where: { orderId: receipt.order!.id },
    });
    await tx.order.update({
      where: { id: receipt.order!.id },
      data: {
        status: "CANCELED",
        paymentStatus: "UNPAID",
        paidAmount: 0,
        metadata: {
          ...(receipt.order!.metadata &&
          typeof receipt.order!.metadata === "object" &&
          !Array.isArray(receipt.order!.metadata)
            ? (receipt.order!.metadata as Record<string, unknown>)
            : {}),
          cancelledAt,
          cancelledById: actorId,
          cancellationReasonCode: parsed.data.reasonCode || null,
          cancellationReason: parsed.data.reason || null,
          refundRequired,
          refundStatus: refundRequired ? "REFUND_REQUIRED" : null,
          refundAmount: refundRequired ? Number(receipt.order.paidAmount) : null,
          refundRequestedAt: refundRequired ? cancelledAt : null,
        } as Prisma.InputJsonValue,
      },
    });
    await tx.receipt.update({
      where: { id },
      data: {
        data: {
          ...baseData,
          ...(existingPod
            ? {
                podDelivery: {
                  ...existingPod,
                  status: "cancelled",
                  cancelledAt,
                  cancelledById: actorId,
                },
              }
            : {}),
          ...(cancelledProjectFlow
            ? { projectFlow: cancelledProjectFlow }
            : {}),
          cancellation: {
            cancelledAt,
            cancelledById: actorId,
            reasonCode: parsed.data.reasonCode || null,
            reason: parsed.data.reason || null,
            refundRequired,
            refundStatus: refundRequired ? "REFUND_REQUIRED" : null,
            refundAmount: refundRequired ? Number(receipt.order.paidAmount) : null,
          },
        } as Prisma.InputJsonValue,
      },
    });
    await tx.actionLog.create({
      data: {
        actorId,
        entity: "Receipt",
        entityId: id,
        action: "CANCELLED_AND_CALCULATIONS_REVERSED",
        before: previous as Prisma.InputJsonValue,
        after: {
          status: "CANCELED",
          paymentStatus: "UNPAID",
          paidAmount: 0,
          reasonCode: parsed.data.reasonCode || null,
          reason: parsed.data.reason || null,
          refundRequired,
          refundStatus: refundRequired ? "REFUND_REQUIRED" : null,
          refundAmount: refundRequired ? Number(receipt.order.paidAmount) : null,
        } as Prisma.InputJsonValue,
      },
    });
  });

  if (receipt.order.attendantId) {
    await recomputeSupportCommissionLedger({
      userId: receipt.order.attendantId,
      period: getTradingPeriodFor(new Date()),
    }).catch(() => undefined);
  }
  publishSummaryUpdate({
    attendantId: receipt.order.attendantId ?? null,
    receiptId: receipt.id,
    timestamp: new Date().toISOString(),
  });
  await syncPosReceiptToCustomerAccount(id).catch(() => undefined);
  return NextResponse.json({ ok: true, status: "CANCELED", refundRequired });
}
