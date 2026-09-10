import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeKenyanPhone } from "@/lib/phone";

const DARAJA_PRODUCTION_BASE_URL = "https://api.safaricom.co.ke";
const DEFAULT_CALLBACK_BASE_URL = "https://betech.co.ke";
export const MPESA_C2B_PAYBILL = "1231008";

type PaymentTarget =
  | { kind: "ORDER"; id: string; reference: string; total: number; paid: number; customerPhone: string | null }
  | { kind: "WEBSITE_ORDER"; id: string; reference: string; total: number; paid: number; dueNow: number; customerPhone: string | null };

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
    c2bValidation: `${base}/api/mpesa/c2b/validation`,
    c2bConfirmation: `${base}/api/mpesa/c2b/confirmation`,
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
    return {
      kind: "WEBSITE_ORDER",
      id: websiteOrder.id,
      reference: websiteOrder.orderRef,
      total: toNumber(websiteOrder.total),
      paid: Math.max(0, toNumber(metadata.amountPaid)),
      dueNow: Math.max(0, toNumber(metadata.amountDueNow) || toNumber(websiteOrder.total)),
      customerPhone: websiteOrder.customerPhone,
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

export async function initiateStkPush(input: { orderReference: string; phoneNumber?: string | null }) {
  const target = await findPaymentTarget(input.orderReference);
  if (!target) throw new Error("Order or invoice was not found");
  const customerPhone = normalizeDarajaPhone(target.customerPhone || "");
  const requestedPhone = normalizeDarajaPhone(input.phoneNumber || target.customerPhone || "");
  if (!requestedPhone) throw new Error("A valid Kenyan mobile number is required");
  // A public order reference is not authority to send prompts to arbitrary numbers.
  if (customerPhone && requestedPhone !== customerPhone) throw new Error("The M-Pesa number must match the order contact number");
  const amount = permittedStkAmount(target);

  const pending = await prisma.mpesaPayment.findFirst({
    where: {
      channel: "STK",
      status: "PENDING",
      ...(target.kind === "ORDER" ? { orderId: target.id } : { websiteOrderId: target.id }),
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
      TransactionDesc: `Betech order ${target.reference}`.slice(0, 182),
    }),
  });
  const result = await response.json().catch(() => ({})) as StkResult;
  if (!response.ok || result.ResponseCode !== "0" || !result.CheckoutRequestID || !result.MerchantRequestID) {
    throw new Error(result.errorMessage || result.ResponseDescription || "M-Pesa could not start the payment request");
  }

  await prisma.mpesaPayment.create({
    data: {
      channel: "STK",
      status: "PENDING",
      ...(target.kind === "ORDER" ? { orderId: target.id } : { websiteOrderId: target.id }),
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

async function applyConfirmedPayment(paymentId: string, input: { amount: number; receiptNumber?: string | null; transactionId?: string | null; phoneNumber?: string | null; transactionAt?: Date | null; resultCode?: number | null; resultDescription?: string | null; payload: unknown }) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.mpesaPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === "SUCCESS" || payment.status === "UNMATCHED") return;
    const amount = Math.max(0, input.amount);
    const common = {
      amount,
      receiptNumber: input.receiptNumber || payment.receiptNumber,
      transactionId: input.transactionId || payment.transactionId,
      phoneNumber: input.phoneNumber || payment.phoneNumber,
      transactionAt: input.transactionAt || payment.transactionAt,
      resultCode: input.resultCode ?? payment.resultCode,
      resultDescription: input.resultDescription || payment.resultDescription,
      callbackPayload: jsonValue(input.payload),
    };

    if (!payment.orderId && !payment.websiteOrderId) {
      await tx.mpesaPayment.update({ where: { id: payment.id }, data: { ...common, status: "UNMATCHED" } });
      return;
    }

    if (payment.orderId) {
      const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
      const paidAmount = Math.min(toNumber(order.totalAmount), Math.max(0, toNumber(order.paidAmount)) + amount);
      await tx.order.update({
        where: { id: order.id },
        data: { paidAmount, paymentStatus: paidAmount >= toNumber(order.totalAmount) ? "PAID" : "PARTIAL", status: paidAmount >= toNumber(order.totalAmount) ? "PROCESSING" : order.status },
      });
    }

    if (payment.websiteOrderId) {
      const order = await tx.websiteOrder.findUniqueOrThrow({ where: { id: payment.websiteOrderId } });
      const metadata = paymentMetadata(order.metadata);
      const paidAmount = Math.min(toNumber(order.total), Math.max(0, toNumber(metadata.amountPaid)) + amount);
      const fullyPaid = paidAmount >= toNumber(order.total);
      await tx.websiteOrder.update({
        where: { id: order.id },
        data: {
          status: fullyPaid ? "PAYMENT_CONFIRMED" : order.status,
          metadata: {
            ...metadata,
            amountPaid: paidAmount,
            totalOutstanding: Math.max(0, toNumber(order.total) - paidAmount),
            mpesaPaymentStatus: fullyPaid ? "SUCCESS" : "PARTIAL",
            lastMpesaReceiptNumber: input.receiptNumber || null,
            lastMpesaPaymentAt: (input.transactionAt || new Date()).toISOString(),
          },
        },
      });
    }
    await tx.mpesaPayment.update({ where: { id: payment.id }, data: { ...common, status: "SUCCESS" } });
  });
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
    await applyConfirmedPayment(payment.id, { ...metadata, phoneNumber: normalizeDarajaPhone(metadata.phoneNumber || "") || payment.phoneNumber, resultCode, resultDescription, payload });
    return;
  }
  await prisma.mpesaPayment.update({
    where: { id: payment.id },
    data: { status: resultCode === 1032 ? "CANCELLED" : "FAILED", resultCode: Number.isFinite(resultCode) ? resultCode : null, resultDescription, callbackPayload: jsonValue(payload) },
  });
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
  await applyConfirmedPayment(payment.id, { amount, receiptNumber, transactionId, phoneNumber, transactionAt, resultCode: 0, resultDescription: "C2B payment received", payload });
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
