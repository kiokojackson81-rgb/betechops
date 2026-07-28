import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import {
  buildReceiptProjectFlow,
  getReceiptProjectCompletionDate,
  readReceiptProjectFlow,
  RECEIPT_PROJECT_HANDLER_TYPES,
  RECEIPT_PROJECT_DEPOSIT_TYPES,
  RECEIPT_PROJECT_PAYMENT_METHODS,
  RECEIPT_PROJECT_PAYMENT_TERMS,
  RECEIPT_PROJECT_STAGES,
} from "@/lib/receiptProjects";
import { auth } from "@/lib/auth";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";
import { buildReceiptKey, canonicalReceiptNumber, parsePaymentMethod } from "@/lib/receipts/utils";
import { isDeliveryFeePayloadItem } from "@/lib/supportPricing";
import { recalcSupportEntry } from "@/lib/marketingReceiptCleanup";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  stage: z.enum(RECEIPT_PROJECT_STAGES).optional(),
  paymentTerm: z.enum(RECEIPT_PROJECT_PAYMENT_TERMS).optional(),
  depositType: z.enum(RECEIPT_PROJECT_DEPOSIT_TYPES).optional(),
  depositValue: z.number().min(0).optional(),
  depositPercent: z.number().min(0).max(100).optional(),
  depositPaidAmount: z.number().min(0).optional(),
  depositPaymentMethod: z.enum(RECEIPT_PROJECT_PAYMENT_METHODS).optional(),
  depositReference: z.string().trim().nullable().optional(),
  balancePaidAmount: z.number().min(0).optional(),
  balancePaymentMethod: z.enum(RECEIPT_PROJECT_PAYMENT_METHODS).optional(),
  balanceReference: z.string().trim().nullable().optional(),
  scheduledDate: z.string().trim().nullable().optional(),
  internalNotes: z.string().trim().nullable().optional(),
  paymentNotes: z.string().trim().nullable().optional(),
  handlerType: z.enum(RECEIPT_PROJECT_HANDLER_TYPES).nullable().optional(),
  handlerStaffId: z.string().trim().nullable().optional(),
  handlerStaffName: z.string().trim().nullable().optional(),
  externalAgentName: z.string().trim().nullable().optional(),
  externalAgentPhone: z.string().trim().nullable().optional(),
});

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveId(context: ParamsContext) {
  const params = await (context as { params: Promise<{ id: string }> | { id: string } }).params;
  return params.id;
}

function extractSupportReceiptItems(data: Record<string, unknown>) {
  const rawItems = data.items;
  if (!Array.isArray(rawItems)) return [] as Array<{ productName: string; buyingPrice: number | null }>;

  return rawItems
    .map((item) => {
      const entry = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const productName = String(
        entry.title ??
          entry.productName ??
          entry.name ??
          ((entry.product as Record<string, unknown> | undefined)?.name ?? ""),
      ).trim();
      if (!productName || isDeliveryFeePayloadItem(entry)) return null;
      const quantity = Math.max(1, Math.trunc(Number(entry.quantity ?? 1) || 1));
      const unitBuyingPrice = Number(entry.costPrice ?? entry.buyingPrice ?? 0);
      const buyingPrice = Number.isFinite(unitBuyingPrice) && unitBuyingPrice > 0
        ? Math.max(0, Math.round(unitBuyingPrice * quantity))
        : null;
      return { productName, buyingPrice };
    })
    .filter((item): item is { productName: string; buyingPrice: number | null } => Boolean(item));
}

export async function PATCH(req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;
  const session = await auth().catch(() => null);
  const actor = session?.user as { id?: string | null; role?: string | null; attendantCategory?: string | null } | undefined;
  const actorId = String(actor?.id || "").trim() || null;

  const id = await resolveId(context);
  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project update payload" }, { status: 400 });
  }

  const existing = await prisma.receipt.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          totalAmount: true,
          paidAmount: true,
          orderNumber: true,
          attendantId: true,
        },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const existingData =
    existing.data && typeof existing.data === "object" && !Array.isArray(existing.data)
      ? (existing.data as Record<string, unknown>)
      : {};
  const existingProjectFlow = readReceiptProjectFlow(existingData.projectFlow);
  if (!existingProjectFlow && String(existingData.customerType || "").toLowerCase() !== "project") {
    return NextResponse.json({ error: "This receipt is not tagged as a project receipt" }, { status: 400 });
  }

  if (guard.role === "ATTENDANT") {
    const assignedToActor = String(existingProjectFlow?.handlerStaffId || "").trim() === actorId;
    const createdByActor = String(existing.issuedById || "").trim() === actorId;
    const isTechnicalActor = isTechnicalTeamCategory(actor?.attendantCategory);
    if (!isTechnicalActor || (!assignedToActor && !createdByActor)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const nextProjectFlow = buildReceiptProjectFlow({
    existing: existingProjectFlow as unknown as Record<string, unknown> | null,
    stage: parsed.data.stage ?? existingProjectFlow?.stage,
    paymentTerm: parsed.data.paymentTerm ?? existingProjectFlow?.paymentTerm,
    projectValue: Number(existing.order?.totalAmount ?? existingProjectFlow?.projectValue ?? 0),
    amountPaidTotal: Number(existing.order?.paidAmount ?? existingProjectFlow?.amountPaidTotal ?? 0),
    depositType: parsed.data.depositType ?? existingProjectFlow?.depositType,
    depositValue: parsed.data.depositValue ?? existingProjectFlow?.depositValue,
    depositPercent: parsed.data.depositPercent ?? existingProjectFlow?.depositPercent,
    depositPaidAmount: parsed.data.depositPaidAmount ?? existingProjectFlow?.depositPaidAmount,
    depositPaymentMethod: parsed.data.depositPaymentMethod ?? existingProjectFlow?.depositPaymentMethod,
    depositReference: parsed.data.depositReference ?? existingProjectFlow?.depositReference,
    balancePaidAmount: parsed.data.balancePaidAmount ?? existingProjectFlow?.balancePaidAmount,
    balancePaymentMethod: parsed.data.balancePaymentMethod ?? existingProjectFlow?.balancePaymentMethod,
    balanceReference: parsed.data.balanceReference ?? existingProjectFlow?.balanceReference,
    scheduledDate:
      parsed.data.scheduledDate !== undefined ? parsed.data.scheduledDate : existingProjectFlow?.scheduledDate,
    postedReceiptNumber: existing.order?.orderNumber ?? existingProjectFlow?.postedReceiptNumber ?? null,
    internalNotes:
      parsed.data.internalNotes !== undefined ? parsed.data.internalNotes : existingProjectFlow?.internalNotes,
    paymentNotes:
      parsed.data.paymentNotes !== undefined ? parsed.data.paymentNotes : existingProjectFlow?.paymentNotes,
    handlerType:
      parsed.data.handlerType !== undefined ? parsed.data.handlerType : existingProjectFlow?.handlerType,
    handlerStaffId:
      parsed.data.handlerStaffId !== undefined ? parsed.data.handlerStaffId : existingProjectFlow?.handlerStaffId,
    handlerStaffName:
      parsed.data.handlerStaffName !== undefined
        ? parsed.data.handlerStaffName
        : existingProjectFlow?.handlerStaffName,
    externalAgentName:
      parsed.data.externalAgentName !== undefined
        ? parsed.data.externalAgentName
        : existingProjectFlow?.externalAgentName,
    externalAgentPhone:
      parsed.data.externalAgentPhone !== undefined
        ? parsed.data.externalAgentPhone
        : existingProjectFlow?.externalAgentPhone,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.update({
      where: { id },
      data: {
        data: {
          ...existingData,
          customerType: "project",
          projectFlow: nextProjectFlow,
        },
        order: existing.order
          ? {
              update: {
                paidAmount: nextProjectFlow.totalPaidAmount,
                paymentStatus:
                  nextProjectFlow.paymentStatus === "FULLY_PAID"
                    ? "PAID"
                    : nextProjectFlow.paymentStatus === "PARTIALLY_PAID"
                      ? "PARTIAL"
                      : "UNPAID",
                status:
                  nextProjectFlow.stage === "COMPLETED_POSTED"
                    ? "COMPLETED"
                    : "PENDING",
              },
            }
          : undefined,
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            paidAmount: true,
            attendantId: true,
          },
        },
      },
    });

    const attendantId = String(receipt.order?.attendantId ?? existing.issuedById ?? "").trim() || null;
    const rawReceiptNumber = String(receipt.order?.orderNumber ?? existing.receiptNumber ?? "").trim();
    const normalizedReceiptNumber = canonicalReceiptNumber(rawReceiptNumber);

    if (
      nextProjectFlow.stage === "COMPLETED_POSTED" &&
      attendantId &&
      normalizedReceiptNumber &&
      tx.supportDailyEntry &&
      tx.supportReceipt
    ) {
      const completionDate =
        getReceiptProjectCompletionDate(nextProjectFlow, new Date(), receipt.createdAt) ?? new Date();
      const dayStart = new Date(completionDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(completionDate);
      dayEnd.setHours(23, 59, 59, 999);
      const dayOfWeek = completionDate.toLocaleDateString("en-KE", { weekday: "long" });
      const sellingTotal = Math.max(
        0,
        Math.round(
          Number(
            ((receipt.totals as Record<string, unknown> | null)?.total as number | undefined) ??
              receipt.order?.totalAmount ??
              0,
          ),
        ),
      );
      const receiptItems = extractSupportReceiptItems(existingData);
      const derivedBuyingTotal = receiptItems.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0);
      const receiptKey = buildReceiptKey(completionDate, normalizedReceiptNumber);
      const paymentMethod = parsePaymentMethod(
        (existingData as Record<string, unknown>).paymentMethod,
        PaymentMethod,
      );
      const supportEntry =
        await tx.supportDailyEntry.findFirst({
          where: { submittedById: attendantId, date: { gte: dayStart, lte: dayEnd } },
          select: { id: true },
        }) ??
        (await tx.supportDailyEntry.create({
          data: {
            date: dayStart,
            dayOfWeek,
            totalSales: 0,
            totalProfit: 0,
            newBatteries: 0,
            changedBatteries: 0,
            submittedById: attendantId,
          },
          select: { id: true },
        }));

      const existingSupportReceipt = await tx.supportReceipt.findFirst({
        where: {
          OR: [
            { receiptNumber: normalizedReceiptNumber },
            ...(receiptKey ? [{ receiptKey }] : []),
          ],
        },
        include: {
          items: true,
        },
      });

      if (existingSupportReceipt) {
        const nextBuyingTotal =
          derivedBuyingTotal > 0 || (existingSupportReceipt.items?.length ?? 0) === 0
            ? derivedBuyingTotal
            : Number(existingSupportReceipt.buyingTotal ?? 0);
        const shouldSeedItems = (existingSupportReceipt.items?.length ?? 0) === 0 && receiptItems.length > 0;
        if (shouldSeedItems) {
          await tx.supportReceiptItem.deleteMany({ where: { receiptId: existingSupportReceipt.id } });
        }
        await tx.supportReceipt.update({
          where: { id: existingSupportReceipt.id },
          data: {
            dailyEntryId: supportEntry.id,
            receiptNumber: normalizedReceiptNumber,
            receiptKey,
            paymentMethod: existingSupportReceipt.paymentMethod ?? paymentMethod,
            sellingTotal,
            buyingTotal: nextBuyingTotal,
            ...(shouldSeedItems ? { items: { create: receiptItems } } : {}),
          },
        });
        await recalcSupportEntry(tx, supportEntry.id);
        if (existingSupportReceipt.dailyEntryId !== supportEntry.id) {
          await recalcSupportEntry(tx, existingSupportReceipt.dailyEntryId);
        }
      } else {
        await tx.supportReceipt.create({
          data: {
            dailyEntryId: supportEntry.id,
            receiptNumber: normalizedReceiptNumber,
            receiptKey,
            paymentMethod,
            sellingTotal,
            buyingTotal: derivedBuyingTotal,
            ...(receiptItems.length ? { items: { create: receiptItems } } : {}),
          },
        });
        await recalcSupportEntry(tx, supportEntry.id);
      }
    }

    return receipt;
  });

  return NextResponse.json({
    ok: true,
    projectFlow: nextProjectFlow,
    receipt: updated,
  });
}
