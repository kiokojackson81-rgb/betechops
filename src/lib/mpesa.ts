import "server-only";

import { randomUUID } from "crypto";
import { MpesaPayment, MpesaPaymentPurpose, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeKenyanPhone } from "@/lib/phone";
import { ensureSiteVisitsSchema } from "@/lib/siteVisits";
import { getLppAccountSummary, recordLppPayment } from "@/lib/lipaPolePoleService";
import { notifyAdminCriticalSms } from "@/lib/adminCriticalSms";
import { dispatchSiteVisitCreated } from "@/lib/siteVisitNotifications";

const DARAJA_PRODUCTION_BASE_URL = "https://api.safaricom.co.ke";
const DEFAULT_CALLBACK_BASE_URL = "https://betech.co.ke";
export const MPESA_C2B_PAYBILL = "1231008";

type PaymentTarget =
  | { kind: "ORDER"; id: string; reference: string; total: number; paid: number; customerPhone: string | null; purpose: MpesaPaymentPurpose }
  | { kind: "WEBSITE_ORDER"; id: string; reference: string; total: number; paid: number; dueNow: number; customerPhone: string | null; purpose: MpesaPaymentPurpose; awaitingPayment: boolean; paymentAccessToken: string | null }
  | { kind: "SITE_VISIT"; id: string; reference: string; total: number; paid: number; customerPhone: string | null; purpose: "SITE_VISIT_FEE" }
  | { kind: "LPP"; id: string; reference: string; total: number; paid: number; customerPhone: string | null; purpose: "LPP_INSTALLMENT" };

export const MPESA_STK_RESOURCE_TYPES = ["ORDER", "SITE_VISIT", "LPP"] as const;
export type MpesaStkResourceType = (typeof MPESA_STK_RESOURCE_TYPES)[number];

export type MpesaReconciliationTarget = {
  kind: "ORDER" | "WEBSITE_ORDER";
  id: string;
};

type StkResult = {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
  CustomerMessage?: string;
  errorCode?: string;
  errorMessage?: string;
};

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function callbackBaseUrl() {
  const candidate = (process.env.MPESA_CALLBACK_BASE_URL || DEFAULT_CALLBACK_BASE_URL).trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("MPESA_CALLBACK_BASE_URL must be a valid HTTPS URL");
  }
  if (parsed.protocol !== "https:") throw new Error("MPESA_CALLBACK_BASE_URL must use HTTPS");
  return parsed.origin;
}

export function mpesaCallbackUrls() {
  const base = callbackBaseUrl();
  return {
    stk: `${base}/api/mpesa/stk/callback`,
    c2bValidation: `${base}/api/payments/c2b/validation`,
    c2bConfirmation: `${base}/api/payments/c2b/confirmation`,
  };
}

function mpesaCredentials() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim();
  const passkey = process.env.MPESA_PASSKEY?.trim();
  const shortcode = process.env.MPESA_SHORTCODE?.trim();
  if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
    throw new Error("M-Pesa production credentials are not fully configured");
  }
  if (!/^\d+$/.test(shortcode)) throw new Error("MPESA_SHORTCODE must contain digits only");
  return { consumerKey, consumerSecret, passkey, shortcode };
}

function darajaTimestamp(now = new Date()) {
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(format.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

async function darajaAccessToken() {
  const { consumerKey, consumerSecret } = mpesaCredentials();
  const authorization = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const response = await fetch(`${DARAJA_PRODUCTION_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${authorization}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  const token = typeof body?.access_token === "string" ? body.access_token : "";
  if (!response.ok || !token) throw new Error("Unable to obtain an M-Pesa access token");
  return token;
}

function normalizeDarajaPhone(value: string) {
  const normalized = normalizeKenyanPhone(value);
  return normalized ? normalized.slice(1) : "";
}

function paymentMetadata(value: unknown) {
  return readObject(value);
}

async function findPaymentTarget(reference: string): Promise<PaymentTarget | null> {
  const normalized = reference.trim();
  if (!normalized) return null;

  const websiteOrder = await prisma.websiteOrder.findFirst({
    where: { orderRef: { equals: normalized, mode: "insensitive" } },
    select: { id: true, orderRef: true, total: true, customerPhone: true, metadata: true, status: true },
  });
  if (websiteOrder && websiteOrder.status !== "CANCELLED") {
    const metadata = paymentMetadata(websiteOrder.metadata);
    const option = String(metadata.paymentOption || "");
    return {
      kind: "WEBSITE_ORDER",
      id: websiteOrder.id,
      reference: websiteOrder.orderRef,
      total: toNumber(websiteOrder.total),
      paid: Math.max(0, toNumber(metadata.amountPaid)),
      dueNow: Math.max(0, toNumber(metadata.amountDueNow) || toNumber(websiteOrder.total)),
      customerPhone: websiteOrder.customerPhone,
      purpose: option === "PAY_30_PERCENT_DEPOSIT" || option === "PAY_10_PERCENT_COMMITMENT"
        ? "ORDER_DEPOSIT"
        : option === "PAY_TRANSPORT_FEE_FIRST"
          ? "ORDER_TRANSPORT"
          : "ORDER_PAYMENT",
      awaitingPayment: websiteOrder.status === "AWAITING_PAYMENT",
      paymentAccessToken: typeof metadata.paymentAccessToken === "string" ? metadata.paymentAccessToken : null,
    };
  }

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: { equals: normalized, mode: "insensitive" } },
        { receipt: { receiptNumber: { equals: normalized, mode: "insensitive" } } },
      ],
      status: { not: "CANCELED" },
    },
    select: { id: true, orderNumber: true, totalAmount: true, paidAmount: true, customerPhone: true },
  });
  if (!order) return null;
  return {
    kind: "ORDER",
    id: order.id,
    reference: order.orderNumber,
    total: toNumber(order.totalAmount),
    paid: Math.max(0, toNumber(order.paidAmount)),
    customerPhone: order.customerPhone,
    purpose: "ORDER_PAYMENT",
  };
}

function permittedStkAmount(target: PaymentTarget) {
  const balance = Math.max(0, target.total - target.paid);
  const amount = target.kind === "WEBSITE_ORDER"
    ? Math.min(balance, Math.max(0, target.dueNow - target.paid))
    : balance;
  if (!Number.isInteger(amount) || amount < 1) throw new Error("There is no whole-KES amount currently due for this order");
  return amount;
}

type SiteVisitPaymentRow = {
  id: string;
  visitRef: string;
  customerPhone: string;
  totalPayable: number | null;
  paymentAmount: number | null;
  paymentStatus: string | null;
};

async function findSiteVisitPaymentTarget(reference: string): Promise<PaymentTarget | null> {
  await ensureSiteVisitsSchema();
  const rows = await prisma.$queryRaw<SiteVisitPaymentRow[]>(Prisma.sql`
    SELECT "id", "visitRef", "customerPhone", "totalPayable", "paymentAmount", "paymentStatus"
    FROM "SiteVisit"
    WHERE LOWER("visitRef") = LOWER(${reference.trim()})
    LIMIT 1
  `);
  const visit = rows[0];
  if (!visit || visit.paymentStatus === "PAID" || visit.paymentStatus === "WAIVED") return null;
  return {
    kind: "SITE_VISIT", id: visit.id, reference: visit.visitRef,
    total: Math.max(0, toNumber(visit.totalPayable)), paid: Math.max(0, toNumber(visit.paymentAmount)),
    customerPhone: visit.customerPhone || null, purpose: "SITE_VISIT_FEE",
  };
}

async function findLppPaymentTarget(reference: string): Promise<PaymentTarget | null> {
  const lpp = await prisma.lipaPolePole.findFirst({
    where: { reference: { equals: reference.trim(), mode: "insensitive" } },
    select: { id: true, reference: true, agreedTotal: true, customer: { select: { phone: true } } },
  });
  if (!lpp) return null;
  const summary = await getLppAccountSummary(lpp.id);
  if (summary.summary.balance.lte(0)) return null;
  return {
    kind: "LPP", id: lpp.id, reference: lpp.reference, total: toNumber(lpp.agreedTotal),
    paid: toNumber(summary.summary.totalPaid), customerPhone: lpp.customer.phone || null, purpose: "LPP_INSTALLMENT",
  };
}

async function findStkTarget(resourceType: MpesaStkResourceType, reference: string) {
  if (resourceType === "ORDER") return findPaymentTarget(reference);
  if (resourceType === "SITE_VISIT") return findSiteVisitPaymentTarget(reference);
  return findLppPaymentTarget(reference);
}

function permittedStkAmountForTarget(target: PaymentTarget, chosenAmount?: number | null) {
  if (target.kind !== "LPP") return permittedStkAmount(target);
  const balance = Math.max(0, target.total - target.paid);
  const amount = Number(chosenAmount);
  if (!Number.isInteger(amount) || amount < 1 || amount > balance) {
    throw new Error("Enter a whole-KES installment amount that does not exceed the outstanding balance");
  }
  return amount;
}

export async function initiateStkPushForResource(input: {
  resourceType: MpesaStkResourceType;
  reference: string;
  phoneNumber?: string | null;
  installmentAmount?: number | null;
  paymentAccessToken?: string | null;
}) {
  const target = await findStkTarget(input.resourceType, input.reference);
  if (!target) throw new Error("The payment record was not found or has no outstanding balance");
  if (target.kind === "WEBSITE_ORDER" && target.awaitingPayment && target.paymentAccessToken !== String(input.paymentAccessToken || "")) {
    throw new Error("This checkout payment session has expired. Return to checkout and try again.");
  }
  const requestedPhone = normalizeDarajaPhone(input.phoneNumber || target.customerPhone || "");
  if (!requestedPhone) throw new Error("A valid Kenyan mobile number is required");
  // The payer's M-Pesa number is deliberately independent from the order or
  // account contact number: a customer may pay from another authorised line.
  const amount = permittedStkAmountForTarget(target, input.installmentAmount);

  const pending = await prisma.mpesaPayment.findFirst({
    where: {
      channel: "STK",
      status: "PENDING",
      ...(target.kind === "ORDER" ? { orderId: target.id } : target.kind === "WEBSITE_ORDER" ? { websiteOrderId: target.id } : { resourceType: target.kind, resourceId: target.id }),
      phoneNumber: requestedPhone,
      createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
    },
    select: { checkoutRequestId: true },
  });
  if (pending?.checkoutRequestId) return { checkoutRequestId: pending.checkoutRequestId, amount, alreadyPending: true };

  const { shortcode, passkey } = mpesaCredentials();
  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const token = await darajaAccessToken();
  const callbackUrl = mpesaCallbackUrls().stk;
  const response = await fetch(`${DARAJA_PRODUCTION_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: requestedPhone,
      PartyB: shortcode,
      PhoneNumber: requestedPhone,
      CallBackURL: callbackUrl,
      AccountReference: target.reference,
      TransactionDesc: `Betech ${target.kind.toLowerCase().replace(/_/g, " ")} ${target.reference}`.slice(0, 182),
    }),
  });
  const result = await response.json().catch(() => ({})) as StkResult;
  if (!response.ok || result.ResponseCode !== "0" || !result.CheckoutRequestID || !result.MerchantRequestID) {
    throw new Error(result.errorMessage || result.ResponseDescription || "M-Pesa could not start the payment request");
  }

  if (target.kind === "LPP") {
    await prisma.$executeRaw(Prisma.sql`UPDATE "LipaPolePole" SET "status" = 'AWAITING_PAYMENT'::"LipaPolePoleStatus", "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${target.id} AND "status" IN ('AWAITING_PAYMENT'::"LipaPolePoleStatus", 'PAYMENT_FAILED'::"LipaPolePoleStatus")`);
  }
  if (target.kind === "SITE_VISIT") {
    await prisma.$executeRaw(Prisma.sql`UPDATE "SiteVisit" SET "status" = 'PAYMENT_PENDING', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${target.id} AND "status" IN ('PAYMENT_PENDING', 'PAYMENT_FAILED')`);
  }

  await prisma.mpesaPayment.create({
    data: {
      channel: "STK",
      status: "PENDING",
      ...(target.kind === "ORDER" ? { orderId: target.id } : target.kind === "WEBSITE_ORDER" ? { websiteOrderId: target.id } : { resourceType: target.kind, resourceId: target.id }),
      purpose: target.purpose,
      accountReference: target.reference,
      requestedAmount: amount,
      phoneNumber: requestedPhone,
      merchantRequestId: result.MerchantRequestID,
      checkoutRequestId: result.CheckoutRequestID,
      resultDescription: result.ResponseDescription || result.CustomerMessage || null,
      callbackPayload: jsonValue(result),
    },
  });
  return { checkoutRequestId: result.CheckoutRequestID, amount, alreadyPending: false };
}

/** Backwards-compatible order-only entry point used by the public STK route. */
export async function initiateStkPush(input: { orderReference: string; phoneNumber?: string | null }) {
  return initiateStkPushForResource({ resourceType: "ORDER", reference: input.orderReference, phoneNumber: input.phoneNumber });
}

export async function getStkPaymentStatus(checkoutRequestId: string) {
  let payment = await prisma.mpesaPayment.findUnique({
    where: { checkoutRequestId },
    select: {
      id: true,
      status: true,
      requestedAmount: true,
      amount: true,
      receiptNumber: true,
      resultDescription: true,
      accountReference: true,
      channel: true,
      orderId: true,
      websiteOrderId: true,
      phoneNumber: true,
      createdAt: true,
      callbackPayload: true,
    },
  });
  if (!payment || payment.channel !== "STK") return null;

  // Daraja sends a C2B confirmation for a successful PayBill STK payment as
  // well as the STK callback.  If the C2B confirmation was delivered but the
  // STK callback was delayed or lost, safely recover the waiting checkout
  // from the already-applied C2B receipt.  This changes ledger state only
  // after the same strict correlation checks used by callback processing.
  if (payment.status === "PENDING") {
    await correlatePendingStkWithConfirmedC2b(payment.id);
    payment = await prisma.mpesaPayment.findUnique({
      where: { checkoutRequestId },
      select: {
        id: true,
        status: true,
        requestedAmount: true,
        amount: true,
        receiptNumber: true,
        resultDescription: true,
        accountReference: true,
        channel: true,
        orderId: true,
        websiteOrderId: true,
        phoneNumber: true,
        createdAt: true,
        callbackPayload: true,
      },
    });
  }
  if (!payment || payment.channel !== "STK") return null;
  return {
    status: payment.status,
    amount: payment.amount == null ? toNumber(payment.requestedAmount) : toNumber(payment.amount),
    // A C2B and STK notification for one physical transaction share the
    // Safaricom receipt.  The ledger intentionally keeps receipt numbers
    // globally unique, so a correlated STK row references (rather than
    // duplicates) the receipt stored on the authoritative C2B row.
    receiptNumber: payment.receiptNumber || correlatedReceiptNumber(payment.callbackPayload),
    resultDescription: payment.resultDescription,
    accountReference: payment.accountReference,
  };
}

const STK_C2B_CORRELATION_WINDOW_MS = 30 * 60 * 1000;

function correlatedReceiptNumber(payload: unknown) {
  const correlation = readObject(readObject(payload).correlation);
  const receipt = String(correlation.receiptNumber || "").trim();
  return receipt || null;
}

function canCorrelateStkAndC2b(stk: Pick<MpesaPayment, "orderId" | "websiteOrderId" | "accountReference" | "requestedAmount" | "phoneNumber" | "createdAt">) {
  const amount = toNumber(stk.requestedAmount);
  return Boolean(
    amount > 0
    && stk.accountReference
    && (stk.orderId || stk.websiteOrderId),
  );
}

async function findConfirmedC2bForStk(
  tx: Prisma.TransactionClient,
  stk: Pick<MpesaPayment, "orderId" | "websiteOrderId" | "accountReference" | "requestedAmount" | "phoneNumber" | "createdAt">,
  expectedReceiptNumber?: string | null,
) {
  if (!canCorrelateStkAndC2b(stk)) return null;
  const createdAfter = new Date(stk.createdAt.getTime() - 2 * 60 * 1000);
  const createdBefore = new Date(stk.createdAt.getTime() + STK_C2B_CORRELATION_WINDOW_MS);
  const c2b = await tx.mpesaPayment.findFirst({
    where: {
      channel: "C2B",
      status: "SUCCESS",
      accountReference: { equals: stk.accountReference!, mode: "insensitive" },
      amount: toNumber(stk.requestedAmount),
      // C2B payloads can omit MSISDN.  When Safaricom supplies it, it must
      // match the STK payer; when it is absent, the order link, exact amount,
      // reference and short delivery window remain mandatory.
      ...(stk.phoneNumber ? { OR: [{ phoneNumber: stk.phoneNumber }, { phoneNumber: null }] } : {}),
      createdAt: { gte: createdAfter, lte: createdBefore },
      ...(stk.orderId ? { orderId: stk.orderId } : { websiteOrderId: stk.websiteOrderId! }),
    },
  });
  if (!c2b) return null;
  if (expectedReceiptNumber && c2b.receiptNumber !== expectedReceiptNumber) return null;
  return c2b;
}

function correlatedStkPayload(stk: MpesaPayment, c2b: MpesaPayment, stkCallback?: unknown) {
  return jsonValue({
    initiation: stk.callbackPayload ?? {},
    ...(stkCallback === undefined ? {} : { stkCallback }),
    correlation: {
      source: "C2B",
      paymentId: c2b.id,
      receiptNumber: c2b.receiptNumber,
      transactionId: c2b.transactionId,
      correlatedAt: new Date().toISOString(),
    },
  });
}

/**
 * Marks an STK request as confirmed by its matching, already-applied C2B
 * receipt.  It deliberately does not copy the receipt/transaction ID: those
 * fields are unique ledger keys and belong to the C2B payment that performed
 * the single accounting application.
 */
async function correlatePendingStkWithConfirmedC2b(paymentId: string, stkCallback?: unknown, expectedReceiptNumber?: string | null) {
  return prisma.$transaction(async (tx) => {
    const stk = await tx.mpesaPayment.findUnique({ where: { id: paymentId } });
    if (!stk || stk.channel !== "STK" || stk.status !== "PENDING") return false;
    const c2b = await findConfirmedC2bForStk(tx, stk, expectedReceiptNumber);
    if (!c2b) return false;

    const claimed = await tx.mpesaPayment.updateMany({
      where: { id: stk.id, status: "PENDING" },
      data: {
        status: "SUCCESS",
        amount: c2b.amount,
        resultCode: 0,
        resultDescription: stkCallback === undefined
          ? `Confirmed by matching C2B receipt ${c2b.receiptNumber || c2b.transactionId || ""}`.trim()
          : `STK callback confirmed; matching C2B receipt ${c2b.receiptNumber || c2b.transactionId || ""} was already applied`.trim(),
        transactionAt: c2b.transactionAt,
        callbackPayload: correlatedStkPayload(stk, c2b, stkCallback),
      },
    });
    return claimed.count === 1;
  });
}

function parseStkMetadata(callback: Record<string, unknown>) {
  const items = Array.isArray(callback.CallbackMetadata && readObject(callback.CallbackMetadata).Item)
    ? readObject(callback.CallbackMetadata).Item as Array<Record<string, unknown>> : [];
  const values = new Map(items.map((item) => [String(item.Name || ""), item.Value]));
  return {
    amount: toNumber(values.get("Amount")),
    receiptNumber: String(values.get("MpesaReceiptNumber") || "").trim() || null,
    phoneNumber: String(values.get("PhoneNumber") || "").trim() || null,
    transactionAt: parseDarajaTransactionDate(String(values.get("TransactionDate") || "")),
  };
}

function parseDarajaTransactionDate(value: string) {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;
  // Daraja transaction timestamps are East Africa Time (UTC+03:00).
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]) - 3, Number(match[5]), Number(match[6])));
}

type ConfirmedPaymentInput = {
  amount: number;
  receiptNumber?: string | null;
  transactionId?: string | null;
  phoneNumber?: string | null;
  transactionAt?: Date | null;
  resultCode?: number | null;
  resultDescription?: string | null;
  payload: unknown;
  preserveCallbackPayload?: boolean;
};

type PaymentApplicationResult = {
  applied: boolean;
  paidBefore: number;
  paidAfter: number;
  total: number;
};

function maskedPhone(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 4 ? `${digits.slice(0, 6)}***${digits.slice(-3)}` : null;
}

/**
 * The order state is committed before delivery is attempted. The SMS service
 * records an event-specific idempotency key, so duplicate callbacks/retries
 * can neither duplicate the payment nor the operations notification.
 */
async function notifyConfirmedWebsiteOrder(input: {
  websiteOrderId: string;
  receiptNumber?: string | null;
  paymentAmount: number;
  payerPhone?: string | null;
}) {
  const order = await prisma.websiteOrder.findUnique({
    where: { id: input.websiteOrderId },
    select: {
      id: true,
      orderRef: true,
      customerName: true,
      customerPhone: true,
      total: true,
      paymentMethod: true,
      deliveryMethod: true,
      metadata: true,
    },
  });
  if (!order) return;
  const metadata = paymentMetadata(order.metadata);
  const paid = Math.max(0, toNumber(metadata.amountPaid));
  if (!paid) return;
  const total = toNumber(order.total);
  const receipt = input.receiptNumber || (typeof metadata.lastMpesaReceiptNumber === "string" ? metadata.lastMpesaReceiptNumber : null);
  await notifyAdminCriticalSms({
    eventType: "WEB_ORDER_PAID",
    entityId: order.id,
    title: `Paid web order ${order.orderRef}`,
    details: [
      `Customer: ${order.customerName}`,
      `Total: KSh ${total.toLocaleString("en-KE")}`,
      `Paid: KSh ${paid.toLocaleString("en-KE")}`,
      `Balance: KSh ${Math.max(0, total - paid).toLocaleString("en-KE")}`,
      `Payment: ${order.paymentMethod}`,
      receipt ? `M-Pesa: ${receipt}` : "M-Pesa receipt pending",
      input.payerPhone || order.customerPhone ? `Payer: ${maskedPhone(input.payerPhone || order.customerPhone) || "—"}` : "",
      `Delivery: ${order.deliveryMethod}`,
    ],
    actionPath: `/admin/receipts?tab=website-orders&orderId=${encodeURIComponent(order.id)}`,
    payload: { orderRef: order.orderRef, receiptNumber: receipt, paid, total },
  });
}

async function notifyConfirmedSiteVisit(siteVisitId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; visitRef: string; customerName: string; customerPhone: string; county: string | null; town: string | null; location: string | null; landmark: string | null; assignedTechnicianId: string | null; assignedTechnicianName: string | null; scheduledAt: Date | null; paymentStatus: string; visitFee: number; dataLoggerRequested: boolean; dataLoggerDays: number; dataLoggerFee: number }>>(Prisma.sql`SELECT "id", "visitRef", "customerName", "customerPhone", "county", "town", "location", "landmark", "assignedTechnicianId", "assignedTechnicianName", "scheduledAt", "paymentStatus", "visitFee", "dataLoggerRequested", "dataLoggerDays", "dataLoggerFee" FROM "SiteVisit" WHERE "id" = ${siteVisitId} LIMIT 1`);
  const visit = rows[0];
  if (visit?.paymentStatus === "PAID") await dispatchSiteVisitCreated({ ...visit, scheduledAt: visit.scheduledAt?.toISOString() || null }, "Customer payment confirmed");
}

async function markStkResourcePaymentFailed(payment: MpesaPayment) {
  if (payment.resourceType === "LPP" && payment.resourceId) await prisma.$executeRaw(Prisma.sql`UPDATE "LipaPolePole" SET "status" = 'PAYMENT_FAILED'::"LipaPolePoleStatus", "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${payment.resourceId} AND "status" = 'AWAITING_PAYMENT'::"LipaPolePoleStatus"`);
  if (payment.resourceType === "SITE_VISIT" && payment.resourceId) await prisma.$executeRaw(Prisma.sql`UPDATE "SiteVisit" SET "status" = 'PAYMENT_FAILED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${payment.resourceId} AND "status" = 'PAYMENT_PENDING'`);
}

/**
 * The one accounting path for both confirmed callbacks and staff reconciliation.
 * It must be called inside the transaction that owns the payment-status change.
 */
async function applyConfirmedPaymentInTransaction(
  tx: Prisma.TransactionClient,
  payment: MpesaPayment,
  input: ConfirmedPaymentInput,
): Promise<PaymentApplicationResult> {
  if (payment.status === "UNMATCHED") {
    return { applied: false, paidBefore: 0, paidAfter: 0, total: 0 };
  }

  const amount = Math.max(0, input.amount);
  const common = {
    amount,
    receiptNumber: input.receiptNumber || payment.receiptNumber,
    transactionId: input.transactionId || payment.transactionId,
    phoneNumber: input.phoneNumber || payment.phoneNumber,
    transactionAt: input.transactionAt || payment.transactionAt,
    resultCode: input.resultCode ?? payment.resultCode,
    resultDescription: input.resultDescription || payment.resultDescription,
    ...(input.preserveCallbackPayload ? {} : { callbackPayload: jsonValue(input.payload) }),
  };

  if (!payment.orderId && !payment.websiteOrderId && !payment.resourceType) {
    await tx.mpesaPayment.update({ where: { id: payment.id }, data: { ...common, status: "UNMATCHED" } });
    return { applied: false, paidBefore: 0, paidAfter: 0, total: 0 };
  }

  let paidBefore = 0;
  let paidAfter = 0;
  let total = 0;
  if (payment.orderId) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    total = toNumber(order.totalAmount);
    paidBefore = Math.max(0, toNumber(order.paidAmount));
    paidAfter = Math.min(total, paidBefore + amount);
    await tx.order.update({
      where: { id: order.id },
      data: { paidAmount: paidAfter, paymentStatus: paidAfter >= total ? "PAID" : "PARTIAL", status: paidAfter >= total ? "PROCESSING" : order.status },
    });
  }

  if (payment.websiteOrderId) {
    const order = await tx.websiteOrder.findUniqueOrThrow({ where: { id: payment.websiteOrderId } });
    const metadata = paymentMetadata(order.metadata);
    total = toNumber(order.total);
    paidBefore = Math.max(0, toNumber(metadata.amountPaid));
    paidAfter = Math.min(total, paidBefore + amount);
    const fullyPaid = paidAfter >= total;
    const wasAwaitingPayment = order.status === "AWAITING_PAYMENT";
    await tx.websiteOrder.update({
      where: { id: order.id },
      data: {
        // A deposit/transport payment is sufficient to place a reservation;
        // only a full settlement gets the stronger PAYMENT_CONFIRMED status.
        status: fullyPaid ? "PAYMENT_CONFIRMED" : wasAwaitingPayment ? "CONFIRMED" : order.status,
        metadata: {
          ...metadata,
          amountPaid: paidAfter,
          totalOutstanding: Math.max(0, total - paidAfter),
          mpesaPaymentStatus: fullyPaid ? "SUCCESS" : "PARTIAL",
          checkoutPaymentConfirmedAt: (input.transactionAt || new Date()).toISOString(),
          lastMpesaReceiptNumber: input.receiptNumber || payment.receiptNumber || null,
          lastMpesaPaymentAt: (input.transactionAt || payment.transactionAt || new Date()).toISOString(),
          lastMpesaPayerPhone: input.phoneNumber || payment.phoneNumber || null,
        },
      },
    });
  }
  if (payment.resourceType === "SITE_VISIT" && payment.resourceId) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "SiteVisit"
      SET "paymentStatus" = 'PAID', "status" = CASE WHEN "status" IN ('PAYMENT_PENDING', 'PAYMENT_FAILED') THEN 'PENDING' ELSE "status" END, "paymentMethod" = 'MPESA_STK',
          "paymentReference" = ${input.receiptNumber || payment.receiptNumber || payment.checkoutRequestId},
          "paymentAmount" = ${amount}, "paymentPaidAt" = ${input.transactionAt || new Date()},
          "paymentVerificationStatus" = 'VERIFIED', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${payment.resourceId} AND "paymentStatus" <> 'PAID'
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "SiteVisitEvent" ("id", "siteVisitId", "eventType", "eventLabel", "eventDetail", "metadata")
      VALUES (${randomUUID()}, ${payment.resourceId}, 'MPESA_STK_CONFIRMED', 'M-Pesa STK payment confirmed',
        ${`KES ${amount.toLocaleString("en-KE")} · ${input.receiptNumber || payment.receiptNumber || "receipt pending"}`},
        ${JSON.stringify({ mpesaPaymentId: payment.id, receiptNumber: input.receiptNumber || payment.receiptNumber || null })}::jsonb)
    `);
    total = amount;
    paidBefore = 0;
    paidAfter = amount;
  }
  if (payment.resourceType === "LPP" && payment.resourceId) {
    const lppPayment = await recordLppPayment({
      lipaPolePoleId: payment.resourceId,
      amount,
      method: "MPESA",
      reference: input.receiptNumber || payment.receiptNumber || payment.transactionId || payment.checkoutRequestId,
      receivedAt: input.transactionAt || new Date(),
      notes: `Daraja STK receipt for ${payment.accountReference || "Lipa Pole Pole installment"}.`,
      status: "SUCCESS",
    }, tx);
    total = toNumber(lppPayment.summary.agreedTotal);
    paidAfter = toNumber(lppPayment.summary.totalPaid);
    paidBefore = Math.max(0, paidAfter - amount);
  }
  await tx.mpesaPayment.update({ where: { id: payment.id }, data: { ...common, status: "SUCCESS" } });
  return { applied: true, paidBefore, paidAfter, total };
}

async function applyConfirmedPayment(paymentId: string, input: ConfirmedPaymentInput) {
  return prisma.$transaction(async (tx) => {
    // This conditional claim makes duplicate/retried Daraja callbacks harmless:
    // only the transaction that changes PENDING can apply the accounting entry.
    const claimed = await tx.mpesaPayment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status: "SUCCESS" } });
    if (!claimed.count) return null;
    const payment = await tx.mpesaPayment.findUnique({ where: { id: paymentId } });
    if (!payment) return null;
    const application = await applyConfirmedPaymentInTransaction(tx, payment, input);
    return { payment, application };
  });
}

async function findReconciliationTarget(
  tx: Prisma.TransactionClient,
  target: MpesaReconciliationTarget,
): Promise<PaymentTarget | null> {
  if (target.kind === "ORDER") {
    const order = await tx.order.findUnique({
      where: { id: target.id },
      select: { id: true, orderNumber: true, totalAmount: true, paidAmount: true, customerPhone: true, status: true },
    });
    if (!order || order.status === "CANCELED") return null;
    return {
      kind: "ORDER",
      id: order.id,
      reference: order.orderNumber,
      total: toNumber(order.totalAmount),
      paid: Math.max(0, toNumber(order.paidAmount)),
      customerPhone: order.customerPhone,
      purpose: "ORDER_PAYMENT",
    };
  }

  const websiteOrder = await tx.websiteOrder.findUnique({
    where: { id: target.id },
    select: { id: true, orderRef: true, total: true, customerPhone: true, metadata: true, status: true },
  });
  if (!websiteOrder || websiteOrder.status === "CANCELLED") return null;
  const metadata = paymentMetadata(websiteOrder.metadata);
  return {
    kind: "WEBSITE_ORDER",
    id: websiteOrder.id,
    reference: websiteOrder.orderRef,
    total: toNumber(websiteOrder.total),
    paid: Math.max(0, toNumber(metadata.amountPaid)),
    dueNow: Math.max(0, toNumber(metadata.amountDueNow) || toNumber(websiteOrder.total)),
    customerPhone: websiteOrder.customerPhone,
    purpose: "ORDER_PAYMENT",
    awaitingPayment: websiteOrder.status === "AWAITING_PAYMENT",
    paymentAccessToken: typeof metadata.paymentAccessToken === "string" ? metadata.paymentAccessToken : null,
  };
}

/**
 * Atomically links an unmatched C2B receipt and applies its original ledger
 * amount through the same accounting function used by automatic matching.
 */
export async function reconcileUnmatchedMpesaPayment(input: {
  paymentId: string;
  target: MpesaReconciliationTarget;
  actorId: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.mpesaPayment.findUnique({ where: { id: input.paymentId } });
    if (!payment) throw new Error("M-Pesa payment was not found");
    if (payment.channel !== "C2B" || payment.status !== "UNMATCHED") {
      throw new Error("Only unmatched C2B payments can be reconciled");
    }

    const target = await findReconciliationTarget(tx, input.target);
    if (!target) throw new Error("The selected order is unavailable or cancelled");
    const amount = toNumber(payment.amount ?? payment.requestedAmount);
    if (amount <= 0) throw new Error("This M-Pesa payment has no positive amount to apply");

    // This conditional write is the transaction claim. A concurrent click sees
    // zero affected rows and cannot increment the order a second time.
    const claimed = await tx.mpesaPayment.updateMany({
      where: { id: payment.id, status: "UNMATCHED" },
      data: {
        status: "PENDING",
        ...(target.kind === "ORDER" ? { orderId: target.id, websiteOrderId: null } : { websiteOrderId: target.id, orderId: null }),
      },
    });
    if (claimed.count !== 1) throw new Error("This M-Pesa payment has already been reconciled");

    const linkedPayment: MpesaPayment = {
      ...payment,
      status: "PENDING",
      orderId: target.kind === "ORDER" ? target.id : null,
      websiteOrderId: target.kind === "WEBSITE_ORDER" ? target.id : null,
    };
    const application = await applyConfirmedPaymentInTransaction(tx, linkedPayment, {
      amount,
      receiptNumber: payment.receiptNumber,
      transactionId: payment.transactionId,
      phoneNumber: payment.phoneNumber,
      transactionAt: payment.transactionAt,
      resultCode: payment.resultCode,
      resultDescription: payment.resultDescription,
      payload: payment.callbackPayload,
      preserveCallbackPayload: true,
    });
    if (!application.applied) throw new Error("This M-Pesa payment could not be applied");

    await tx.actionLog.create({
      data: {
        actorId: input.actorId,
        entity: "MpesaPayment",
        entityId: payment.id,
        action: "RECONCILE_UNMATCHED_C2B",
        before: jsonValue({
          status: payment.status,
          accountReference: payment.accountReference,
          amount,
          transactionId: payment.transactionId,
          receiptNumber: payment.receiptNumber,
        }),
        after: jsonValue({
          status: "SUCCESS",
          targetKind: target.kind,
          targetId: target.id,
          targetReference: target.reference,
          paidBefore: application.paidBefore,
          paidAfter: application.paidAfter,
          total: application.total,
        }),
      },
    });

    return {
      paymentId: payment.id,
      targetKind: target.kind,
      targetId: target.id,
      targetReference: target.reference,
      amount,
      paidBefore: application.paidBefore,
      paidAfter: application.paidAfter,
      balance: Math.max(0, application.total - application.paidAfter),
      websiteOrderId: target.kind === "WEBSITE_ORDER" ? target.id : null,
      receiptNumber: payment.receiptNumber,
      payerPhone: payment.phoneNumber,
    };
  });
  if (result.websiteOrderId) {
    await notifyConfirmedWebsiteOrder({
      websiteOrderId: result.websiteOrderId,
      receiptNumber: result.receiptNumber,
      paymentAmount: result.amount,
      payerPhone: result.payerPhone,
    });
  }
  const { websiteOrderId: _websiteOrderId, receiptNumber: _receiptNumber, payerPhone: _payerPhone, ...publicResult } = result;
  return publicResult;
}

export async function handleStkCallback(payload: unknown) {
  const body = readObject(payload);
  const callback = readObject(readObject(body.Body).stkCallback);
  const checkoutRequestId = String(callback.CheckoutRequestID || "").trim();
  const merchantRequestId = String(callback.MerchantRequestID || "").trim();
  const resultCode = Number(callback.ResultCode);
  const resultDescription = String(callback.ResultDesc || "").trim() || null;
  if (!checkoutRequestId) return;
  const payment = await prisma.mpesaPayment.findUnique({ where: { checkoutRequestId } });
  if (!payment) {
    await prisma.mpesaPayment.create({ data: { channel: "STK", status: "UNMATCHED", checkoutRequestId, merchantRequestId: merchantRequestId || null, resultCode: Number.isFinite(resultCode) ? resultCode : null, resultDescription, callbackPayload: jsonValue(payload) } }).catch(() => undefined);
    return;
  }
  if (resultCode === 0) {
    const metadata = parseStkMetadata(callback);
    // When the C2B confirmation won the delivery race, it owns the globally
    // unique Safaricom receipt and has already applied the funds.  Correlate
    // this STK callback to that row instead of attempting a second ledger
    // receipt or a second order increment.
    if (payment.status === "PENDING" && metadata.receiptNumber) {
      const correlated = await correlatePendingStkWithConfirmedC2b(payment.id, payload, metadata.receiptNumber);
      if (correlated) return;
    }
    if (payment.status === "SUCCESS" && !payment.receiptNumber) {
      // A status-poll recovery may have correlated the C2B notification
      // before Daraja retried this STK callback. Keep the raw STK callback for
      // auditability without duplicating the C2B receipt or applying money.
      await prisma.mpesaPayment.update({
        where: { id: payment.id },
        data: {
          resultCode,
          resultDescription: `STK callback confirmed; ${payment.resultDescription || "payment was already confirmed"}`,
          callbackPayload: jsonValue({
            correlation: readObject(readObject(payment.callbackPayload).correlation),
            initiation: readObject(payment.callbackPayload).initiation || payment.callbackPayload || {},
            stkCallback: payload,
          }),
        },
      });
      return;
    }
    const confirmation = await applyConfirmedPayment(payment.id, { ...metadata, phoneNumber: normalizeDarajaPhone(metadata.phoneNumber || "") || payment.phoneNumber, resultCode, resultDescription, payload });
    if (confirmation?.application.applied && confirmation.payment.websiteOrderId) {
      await notifyConfirmedWebsiteOrder({
        websiteOrderId: confirmation.payment.websiteOrderId,
        receiptNumber: metadata.receiptNumber,
        paymentAmount: metadata.amount,
        payerPhone: normalizeDarajaPhone(metadata.phoneNumber || "") || confirmation.payment.phoneNumber,
      });
    }
    if (confirmation?.application.applied && confirmation.payment.resourceType === "SITE_VISIT" && confirmation.payment.resourceId) await notifyConfirmedSiteVisit(confirmation.payment.resourceId);
    return;
  }
  await prisma.mpesaPayment.update({
    where: { id: payment.id },
    data: { status: resultCode === 1032 ? "CANCELLED" : "FAILED", resultCode: Number.isFinite(resultCode) ? resultCode : null, resultDescription, callbackPayload: jsonValue(payload) },
  });
  await markStkResourcePaymentFailed(payment);
}

export async function handleC2bConfirmation(payload: unknown) {
  const body = readObject(payload);
  const transactionId = String(body.TransID || "").trim();
  const receiptNumber = transactionId || null;
  if (!transactionId) return;
  const existing = await prisma.mpesaPayment.findUnique({ where: { transactionId } });
  if (existing) return;
  const reference = String(body.BillRefNumber || "").trim();
  const target = await findPaymentTarget(reference);
  const amount = toNumber(body.TransAmount);
  const transactionAt = parseDarajaTransactionDate(String(body.TransTime || ""));
  const phoneNumber = normalizeDarajaPhone(String(body.MSISDN || "")) || null;
  const payment = await prisma.mpesaPayment.create({
    data: {
      channel: "C2B",
      status: target ? "PENDING" : "UNMATCHED",
      ...(target?.kind === "ORDER" ? { orderId: target.id } : target?.kind === "WEBSITE_ORDER" ? { websiteOrderId: target.id } : {}),
      accountReference: reference || null,
      amount,
      phoneNumber,
      receiptNumber,
      transactionId,
      transactionAt,
      resultCode: 0,
      resultDescription: target ? "C2B payment received" : "Could not match BillRefNumber to a Betech order or invoice",
      callbackPayload: jsonValue(payload),
    },
  }).catch(async (error) => {
    if ((error as { code?: string }).code === "P2002") return null;
    throw error;
  });
  if (!payment || !target) return;
  const confirmation = await applyConfirmedPayment(payment.id, { amount, receiptNumber, transactionId, phoneNumber, transactionAt, resultCode: 0, resultDescription: "C2B payment received", payload });
  if (confirmation?.application.applied && confirmation.payment.websiteOrderId) {
    await notifyConfirmedWebsiteOrder({
      websiteOrderId: confirmation.payment.websiteOrderId,
      receiptNumber,
      paymentAmount: amount,
      payerPhone: phoneNumber,
    });
  }
  // C2B is a real confirmation for PayBill STK too.  A matching pending STK
  // request becomes successful here, but only the C2B row above applies its
  // amount to the order.  Receipt numbers stay unique to the C2B ledger row.
  const c2b = await prisma.mpesaPayment.findUnique({ where: { id: payment.id } });
  if (!c2b || c2b.status !== "SUCCESS") return;
  const candidates = await prisma.mpesaPayment.findMany({
    where: {
      channel: "STK",
      status: "PENDING",
      accountReference: { equals: c2b.accountReference || "", mode: "insensitive" },
      requestedAmount: c2b.amount,
      ...(c2b.phoneNumber ? { phoneNumber: c2b.phoneNumber } : {}),
      createdAt: {
        gte: new Date(c2b.createdAt.getTime() - STK_C2B_CORRELATION_WINDOW_MS),
        lte: new Date(c2b.createdAt.getTime() + 2 * 60 * 1000),
      },
      ...(c2b.orderId ? { orderId: c2b.orderId } : c2b.websiteOrderId ? { websiteOrderId: c2b.websiteOrderId } : { id: "__no_stk_target__" }),
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const stk = candidates[0];
  if (!stk) return;
  // Reuse the inner correlation guard, which re-reads both rows and claims
  // the PENDING STK state atomically.
  await correlatePendingStkWithConfirmedC2b(stk.id);
}

export async function canAcceptC2bReference(reference: string) {
  return Boolean(await findPaymentTarget(reference));
}

export function isExpectedC2bPaybill(payload: unknown) {
  const body = readObject(payload);
  const supplied = String(body.BusinessShortCode || body.ShortCode || "").trim();
  // Older Daraja validation payloads occasionally omit this field. In that
  // case the registered URL itself is the routing boundary.
  return !supplied || supplied === MPESA_C2B_PAYBILL;
}
