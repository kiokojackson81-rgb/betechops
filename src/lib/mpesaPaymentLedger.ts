import { MpesaPaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractMpesaTransactionCode } from "@/lib/mpesaReference";

const MANUAL_LPP_LEDGER_PREFIX = "manual-lpp:";
const LEGACY_POS_LEDGER_PREFIX = "legacy-pos-mpesa:";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function lppStatusToMpesaStatus(status: string): MpesaPaymentStatus {
  switch (status) {
    case "SUCCESS":
      return "SUCCESS";
    case "FAILED":
      return "FAILED";
    case "REVERSED":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

function lppResultDescription(status: string, reference: string | null) {
  const suffix = reference ? ` M-Pesa receipt: ${reference}.` : "";
  if (status === "SUCCESS") return `Lipa Pole Pole M-Pesa payment recorded.${suffix}`;
  if (status === "FAILED") return `Lipa Pole Pole M-Pesa payment rejected.${suffix}`;
  if (status === "REVERSED") return `Lipa Pole Pole M-Pesa payment reversed.${suffix}`;
  return `Lipa Pole Pole M-Pesa payment submitted and awaiting verification.${suffix}`;
}

/**
 * Customer-entered and staff-recorded Lipa Pole Pole M-Pesa receipts used to
 * live only in LipaPolePolePayment. Keep an immutable, searchable mirror in
 * the finance ledger without altering real Daraja C2B records.
 */
export async function syncLppMpesaPaymentToLedger(lppPaymentId: string) {
  const payment = await prisma.lipaPolePolePayment.findUnique({
    where: { id: lppPaymentId },
    include: {
      lipaPolePole: {
        select: {
          id: true,
          reference: true,
          customer: { select: { phone: true } },
        },
      },
    },
  });
  if (!payment || payment.method !== "MPESA") return null;

  const reference = extractMpesaTransactionCode(payment.reference) ?? payment.reference?.trim() ?? null;
  const existingDarajaPayment = reference
    ? await prisma.mpesaPayment.findFirst({
        where: {
          OR: [
            { receiptNumber: reference },
            { transactionId: reference },
          ],
        },
        select: { id: true },
      })
    : null;

  // A callback already owns this Safaricom receipt. It is already visible in
  // the ledger and must remain the single settlement source.
  if (existingDarajaPayment) return existingDarajaPayment;

  const status = lppStatusToMpesaStatus(payment.status);
  const marker = `${MANUAL_LPP_LEDGER_PREFIX}${payment.id}`;
  const amount = new Prisma.Decimal(payment.amount);
  const data = {
    channel: "C2B" as const,
    status,
    purpose: "LPP_INSTALLMENT" as const,
    resourceType: "LPP",
    resourceId: payment.lipaPolePole.id,
    accountReference: payment.lipaPolePole.reference,
    requestedAmount: amount,
    amount,
    phoneNumber: payment.lipaPolePole.customer.phone ?? null,
    receiptNumber: reference,
    transactionId: reference,
    resultCode: status === "SUCCESS" ? 0 : null,
    resultDescription: lppResultDescription(payment.status, reference),
    transactionAt: payment.receivedAt,
    callbackPayload: {
      source: "lpp_manual_payment",
      lppPaymentId: payment.id,
      lppPaymentStatus: payment.status,
      submittedReference: payment.reference,
    } as Prisma.InputJsonValue,
  };

  try {
    return await prisma.mpesaPayment.upsert({
      where: { merchantRequestId: marker },
      create: { ...data, merchantRequestId: marker },
      update: data,
    });
  } catch (error) {
    // A real Daraja callback may arrive between the lookup above and this
    // write. Its globally unique receipt remains authoritative.
    if ((error as { code?: string }).code === "P2002" && reference) {
      return prisma.mpesaPayment.findFirst({
        where: { OR: [{ receiptNumber: reference }, { transactionId: reference }] },
      });
    }
    throw error;
  }
}

/** Repairs historical manual Lipa Pole Pole M-Pesa entries when finance opens the ledger. */
export async function backfillLppMpesaPaymentLedger(take = 500) {
  const payments = await prisma.lipaPolePolePayment.findMany({
    where: { method: "MPESA" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(take, 1000)),
  });
  let synchronized = 0;
  for (const payment of payments) {
    await syncLppMpesaPaymentToLedger(payment.id);
    synchronized += 1;
  }
  return synchronized;
}

const POS_MOBILE_MONEY_METHODS = new Set([
  "MPESA_EXPRESS",
  "MPESA_PAYBILL",
  "EQUITY_PAYBILL",
  "DTB_PAYBILL",
  "ABSA_PAYBILL",
]);

/**
 * Repairs completed POS receipts from before every collection path wrote to
 * MpesaPayment. These are labelled as POS confirmation records; entries with
 * no Safaricom transaction code do not inflate settled M-Pesa totals.
 */
export async function backfillCompletedPosMpesaPaymentLedger(take = 500) {
  const receipts = await prisma.receipt.findMany({
    where: { order: { is: { paymentStatus: "PAID" } } },
    select: {
      id: true,
      createdAt: true,
      data: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          paidAmount: true,
          customerPhone: true,
          metadata: true,
          mpesaPayments: { select: { id: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(take, 1000)),
  });

  let synchronized = 0;
  for (const receipt of receipts) {
    const order = receipt.order;
    if (!order || order.mpesaPayments.length) continue;
    const receiptData = asRecord(receipt.data);
    const orderMetadata = asRecord(order.metadata);
    const method = String(
      receiptData.paymentCollectionMethod ?? orderMetadata.paymentCollectionMethod ?? "",
    ).trim().toUpperCase();
    if (!POS_MOBILE_MONEY_METHODS.has(method)) continue;

    const externalPayment = asRecord(
      receiptData.externalPayment ?? orderMetadata.externalPayment,
    );
    const suppliedReference = String(externalPayment.paymentReference ?? "").trim() || null;
    const marker = `${LEGACY_POS_LEDGER_PREFIX}${order.id}`;
    const amount = new Prisma.Decimal(order.paidAmount ?? order.totalAmount);

    try {
      await prisma.mpesaPayment.upsert({
        where: { merchantRequestId: marker },
        create: {
          channel: method === "MPESA_EXPRESS" ? "STK" : "C2B",
          status: "SUCCESS",
          orderId: order.id,
          purpose: "ORDER_PAYMENT",
          accountReference: order.orderNumber,
          requestedAmount: amount,
          amount,
          phoneNumber: order.customerPhone ?? null,
          merchantRequestId: marker,
          resultCode: 0,
          resultDescription: `Historical POS ${method.replace(/_/g, " ")} payment marked completed; no Daraja callback record was retained.${suppliedReference ? ` Staff reference: ${suppliedReference}.` : ""}`,
          transactionAt: receipt.createdAt,
          callbackPayload: {
            source: "legacy_completed_pos_receipt",
            receiptId: receipt.id,
            paymentCollectionMethod: method,
            staffReference: suppliedReference,
          },
        },
        update: {},
      });
      synchronized += 1;
    } catch (error) {
      // A late callback may have written a real record in the meantime. The
      // next request sees it and does not fabricate a second settlement.
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  return synchronized;
}
