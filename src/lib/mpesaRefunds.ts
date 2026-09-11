import "server-only";

import { createHash, randomInt } from "crypto";
import { MpesaRefundStatus, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { getMpesaDarajaAccessToken, getMpesaShortcode, mpesaCallbackUrls } from "@/lib/mpesa";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

const DARAJA_PRODUCTION_BASE_URL = "https://api.safaricom.co.ke";
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const ACTIVE_REFUND_STATUSES: MpesaRefundStatus[] = ["DRAFT", "OTP_PENDING", "AUTHORIZED", "PROCESSING"];

function amountOf(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function metadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function maskedPhone(phone: string) {
  return phone.length > 6 ? `${phone.slice(0, 6)}•••${phone.slice(-3)}` : "••••";
}

function refundOtpHash(refundId: string, code: string) {
  const secret = process.env.MPESA_REFUND_OTP_SECRET?.trim();
  if (!secret) throw new Error("M-Pesa refund OTP protection is not configured");
  return createHash("sha256").update(`${refundId}:${code}:${secret}`).digest("hex");
}

function reversalCredentials() {
  const initiator = process.env.MPESA_REVERSAL_INITIATOR?.trim();
  const securityCredential = process.env.MPESA_REVERSAL_SECURITY_CREDENTIAL?.trim();
  if (!initiator || !securityCredential) {
    throw new Error("M-Pesa reversal credentials are not configured. Set MPESA_REVERSAL_INITIATOR and MPESA_REVERSAL_SECURITY_CREDENTIAL server-side before executing a refund.");
  }
  return { initiator, securityCredential };
}

export async function requireMpesaRefundAdmin() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; email?: string } | undefined;
  if (!user?.id) return { ok: false as const, status: 401, error: "Unauthorized" };
  const allowlisted = new Set((process.env.MPESA_REFUND_AUTHORIZED_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
  const permitted = user.role === "ADMIN" || (user.role === "SUPERVISOR" && Boolean(user.email && allowlisted.has(user.email.toLowerCase())));
  if (!permitted) return { ok: false as const, status: 403, error: "PAYMENT_REFUND authorization is required" };
  return { ok: true as const, userId: user.id, role: user.role || "", email: user.email || null };
}

async function getEligiblePayment(tx: Prisma.TransactionClient, paymentId: string) {
  const payment = await tx.mpesaPayment.findUnique({
    where: { id: paymentId },
    include: { order: { select: { id: true, orderNumber: true, totalAmount: true, paidAmount: true, paymentStatus: true } }, websiteOrder: { select: { id: true, orderRef: true, total: true, metadata: true, status: true } } },
  });
  if (!payment || payment.status !== "SUCCESS") throw new Error("Only a confirmed successful M-Pesa payment can be refunded");
  const originalAmount = amountOf(payment.amount ?? payment.requestedAmount);
  const payer = normalizeKenyanPhone(payment.phoneNumber || "")?.slice(1) || "";
  const originalTransactionId = payment.transactionId || payment.receiptNumber;
  if (originalAmount <= 0 || !payer || !originalTransactionId) throw new Error("The original payment is missing its amount, payer, or Safaricom receipt and cannot be reversed safely");
  if (!payment.orderId && !payment.websiteOrderId) throw new Error("Only payments linked to an order or website order are eligible for this refund workflow");
  return { payment, originalAmount, payer, originalTransactionId };
}

export async function createMpesaRefundDraft(input: { paymentId: string; amount: number; reason: string; actorId: string }) {
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) throw new Error("Provide a refund reason between 5 and 500 characters");
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error("Refund amount must be a positive whole Kenyan shilling amount");
  return prisma.$transaction(async (tx) => {
    const { payment, originalAmount, payer } = await getEligiblePayment(tx, input.paymentId);
    const existing = await tx.mpesaRefund.findFirst({ where: { originalPaymentId: payment.id, status: { in: ACTIVE_REFUND_STATUSES } }, select: { id: true } });
    if (existing) throw new Error("This M-Pesa payment already has an active refund request");
    const confirmed = await tx.mpesaRefund.aggregate({ where: { originalPaymentId: payment.id, status: "SUCCESS" }, _sum: { amount: true } });
    const refundable = Math.max(0, originalAmount - amountOf(confirmed._sum.amount));
    if (input.amount > refundable) throw new Error(`Refund amount exceeds the remaining refundable amount of KSh ${refundable.toLocaleString("en-KE")}`);
    const refund = await tx.mpesaRefund.create({ data: { originalPaymentId: payment.id, amount: input.amount, reason, originalPayerPhone: payer, requestedById: input.actorId } });
    await tx.actionLog.create({ data: { actorId: input.actorId, entity: "MpesaRefund", entityId: refund.id, action: "CREATE_MOBILE_MONEY_REFUND_DRAFT", before: Prisma.JsonNull, after: json({ originalPaymentId: payment.id, originalTransactionId: payment.transactionId || payment.receiptNumber, amount: input.amount, payer: maskedPhone(payer), reason }) } });
    return { refund, originalAmount, alreadyRefunded: amountOf(confirmed._sum.amount), refundableBefore: refundable };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function sendMpesaRefundOtp(input: { refundId: string; actorId: string }) {
  const prepared = await prisma.$transaction(async (tx) => {
    const refund = await tx.mpesaRefund.findUnique({ where: { id: input.refundId }, include: { requestedBy: { select: { id: true, phone: true, mobileMoneyPhoneNumber: true } } } });
    if (!refund) throw new Error("Refund request was not found");
    if (refund.requestedById !== input.actorId) throw new Error("Only the requesting authorized administrator can verify this refund");
    if (refund.status === "SUCCESS" || refund.status === "PROCESSING") throw new Error("This refund cannot receive another OTP");
    if (refund.otpLastSentAt && Date.now() - refund.otpLastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) throw new Error("Wait one minute before requesting another OTP");
    const phone = normalizeKenyanPhone(refund.requestedBy.mobileMoneyPhoneNumber || refund.requestedBy.phone || "");
    if (!phone) throw new Error("Your authorized staff profile needs a verified Kenyan mobile number before refunds can be approved");
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const updated = await tx.mpesaRefund.update({ where: { id: refund.id }, data: { status: "OTP_PENDING", otpHash: refundOtpHash(refund.id, code), otpExpiresAt: expiresAt, otpAttempts: 0, otpLastSentAt: new Date() } });
    await tx.actionLog.create({ data: { actorId: input.actorId, entity: "MpesaRefund", entityId: refund.id, action: "SEND_REFUND_OTP", before: json({ status: refund.status }), after: json({ status: updated.status, expiresAt, delivery: "SMS", recipient: maskedPhone(phone.slice(1)) }) } });
    return { phone, code, refundId: refund.id, amount: amountOf(refund.amount) };
  });
  try {
    await sendTransactionalSms(prepared.phone, `Betech Solar: refund approval code ${prepared.code}. It authorizes KSh ${prepared.amount.toLocaleString("en-KE")} and expires in 5 minutes. Do not share it.`);
  } catch (error) {
    await prisma.mpesaRefund.updateMany({ where: { id: prepared.refundId, status: "OTP_PENDING" }, data: { status: "DRAFT", otpHash: null, otpExpiresAt: null } });
    throw new Error(error instanceof Error ? `Refund OTP could not be delivered: ${error.message}` : "Refund OTP could not be delivered");
  }
}

export async function authorizeMpesaRefund(input: { refundId: string; code: string; actorId: string }) {
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the six-digit refund approval code");
  return prisma.$transaction(async (tx) => {
    const refund = await tx.mpesaRefund.findUnique({ where: { id: input.refundId } });
    if (!refund) throw new Error("Refund request was not found");
    if (refund.requestedById !== input.actorId) throw new Error("Only the requesting authorized administrator can verify this refund");
    if (refund.status !== "OTP_PENDING" || !refund.otpHash || !refund.otpExpiresAt) throw new Error("Request a new refund approval code first");
    if (refund.otpExpiresAt.getTime() < Date.now()) {
      await tx.mpesaRefund.update({ where: { id: refund.id }, data: { status: "EXPIRED", otpHash: null } });
      throw new Error("This refund approval code has expired");
    }
    if (refund.otpAttempts >= MAX_OTP_ATTEMPTS) {
      await tx.mpesaRefund.update({ where: { id: refund.id }, data: { status: "EXPIRED", otpHash: null } });
      throw new Error("Too many invalid approval attempts. Start a new refund request.");
    }
    if (refundOtpHash(refund.id, code) !== refund.otpHash) {
      const attempts = refund.otpAttempts + 1;
      await tx.mpesaRefund.update({ where: { id: refund.id }, data: { otpAttempts: attempts, ...(attempts >= MAX_OTP_ATTEMPTS ? { status: "EXPIRED", otpHash: null } : {}) } });
      throw new Error("Invalid refund approval code");
    }
    const authorized = await tx.mpesaRefund.update({ where: { id: refund.id }, data: { status: "AUTHORIZED", otpHash: null, authorizedById: input.actorId, authorizedAt: new Date() } });
    await tx.actionLog.create({ data: { actorId: input.actorId, entity: "MpesaRefund", entityId: refund.id, action: "AUTHORIZE_MOBILE_MONEY_REFUND", before: json({ status: refund.status }), after: json({ status: authorized.status, amount: amountOf(refund.amount) }) } });
    return authorized;
  });
}

export async function executeAuthorizedMpesaRefund(input: { refundId: string; actorId: string }) {
  // Read configuration before claiming the request: an environment setup gap
  // leaves an authorized request retryable and never fakes provider acceptance.
  const { initiator, securityCredential } = reversalCredentials();
  const claimed = await prisma.$transaction(async (tx) => {
    const refund = await tx.mpesaRefund.findUnique({ where: { id: input.refundId }, include: { originalPayment: true } });
    if (!refund) throw new Error("Refund request was not found");
    if (refund.requestedById !== input.actorId || refund.authorizedById !== input.actorId) throw new Error("Only the administrator who authorized this refund can execute it");
    if (refund.status !== "AUTHORIZED") throw new Error("This refund is not awaiting execution");
    const original = await getEligiblePayment(tx, refund.originalPaymentId);
    if (original.payer !== refund.originalPayerPhone || amountOf(refund.amount) > original.originalAmount) throw new Error("Original M-Pesa payment validation failed");
    const claimedUpdate = await tx.mpesaRefund.updateMany({ where: { id: refund.id, status: "AUTHORIZED" }, data: { status: "PROCESSING", processingAt: new Date() } });
    if (claimedUpdate.count !== 1) throw new Error("This refund was already processed by another request");
    return { refund, originalTransactionId: original.originalTransactionId, payer: original.payer };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  const callbacks = mpesaCallbackUrls();
  const payload = { Initiator: initiator, SecurityCredential: securityCredential, CommandID: "TransactionReversal", TransactionID: claimed.originalTransactionId, Amount: amountOf(claimed.refund.amount), ReceiverParty: getMpesaShortcode(), RecieverIdentifierType: "11", ResultURL: callbacks.refundResult, QueueTimeOutURL: callbacks.refundTimeout, Remarks: claimed.refund.reason.slice(0, 100), Occasion: `Betech refund ${claimed.refund.id}` };
  let providerAccepted = false;
  try {
    const token = await getMpesaDarajaAccessToken();
    const response = await fetch(`${DARAJA_PRODUCTION_BASE_URL}/mpesa/reversal/v1/request`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
    const responseBody = await response.json().catch(() => ({}));
    const conversationId = String(responseBody.ConversationID || "").trim() || null;
    const originatorId = String(responseBody.OriginatorConversationID || "").trim() || null;
    if (!response.ok || String(responseBody.ResponseCode || "") !== "0") throw new Error(String(responseBody.errorMessage || responseBody.ResponseDescription || "Safaricom did not accept the reversal request"));
    providerAccepted = true;
    if (!conversationId && !originatorId) {
      await prisma.mpesaRefund.updateMany({ where: { id: claimed.refund.id, status: "PROCESSING" }, data: { requestPayload: json({ request: { ...payload, SecurityCredential: "[redacted]" }, response: responseBody }), providerResultDesc: "Safaricom accepted the reversal without a callback correlation ID; hold for manual Safaricom reconciliation." } });
      throw new Error("Safaricom accepted the reversal without a callback correlation ID. The request remains PROCESSING and must not be retried; reconcile it with Safaricom support.");
    }
    await prisma.$transaction(async (tx) => {
      const updated = await tx.mpesaRefund.updateMany({ where: { id: claimed.refund.id, status: "PROCESSING" }, data: { providerConversationId: conversationId, providerOriginatorId: originatorId, requestPayload: json({ request: { ...payload, SecurityCredential: "[redacted]" }, response: responseBody }) } });
      if (updated.count === 1) await tx.actionLog.create({ data: { actorId: input.actorId, entity: "MpesaRefund", entityId: claimed.refund.id, action: "SUBMIT_MOBILE_MONEY_REVERSAL", before: json({ status: "AUTHORIZED" }), after: json({ status: "PROCESSING", originalTransactionId: claimed.originalTransactionId, amount: amountOf(claimed.refund.amount), payer: maskedPhone(claimed.payer), providerConversationId: conversationId, providerOriginatorId: originatorId }) } });
    });
  } catch (error) {
    const description = error instanceof Error ? error.message : "Unable to submit the Safaricom reversal request";
    if (providerAccepted) throw error;
    await prisma.$transaction(async (tx) => {
      const updated = await tx.mpesaRefund.updateMany({ where: { id: claimed.refund.id, status: "PROCESSING" }, data: { status: "FAILED", failedAt: new Date(), providerResultDesc: description } });
      if (updated.count === 1) await tx.actionLog.create({ data: { actorId: input.actorId, entity: "MpesaRefund", entityId: claimed.refund.id, action: "MOBILE_MONEY_REVERSAL_SUBMISSION_FAILED", before: json({ status: "PROCESSING" }), after: json({ status: "FAILED", error: description }) } });
    });
    throw error;
  }
}

function callbackResult(payload: unknown) {
  const root = metadata(payload);
  const result = metadata(root.Result || root);
  return { conversationId: String(result.ConversationID || "").trim(), originatorId: String(result.OriginatorConversationID || "").trim(), code: Number(result.ResultCode), description: String(result.ResultDesc || "").trim() || "Safaricom reversal result" };
}

export async function handleMpesaRefundResult(payload: unknown, isTimeout = false) {
  const result = callbackResult(payload);
  if (!result.conversationId && !result.originatorId) return false;
  return prisma.$transaction(async (tx) => {
    const refund = await tx.mpesaRefund.findFirst({ where: { OR: [{ providerConversationId: result.conversationId || undefined }, { providerOriginatorId: result.originatorId || undefined }] }, include: { originalPayment: true } });
    if (!refund || refund.status !== "PROCESSING") return false;
    const succeeded = !isTimeout && result.code === 0;
    const claimed = await tx.mpesaRefund.updateMany({ where: { id: refund.id, status: "PROCESSING" }, data: succeeded ? { status: "SUCCESS", completedAt: new Date(), providerResultCode: result.code, providerResultDesc: result.description, callbackPayload: json(payload) } : { status: "FAILED", failedAt: new Date(), providerResultCode: Number.isFinite(result.code) ? result.code : null, providerResultDesc: result.description, callbackPayload: json(payload) } });
    if (claimed.count !== 1) return false;
    if (succeeded) {
      if (refund.originalPayment.orderId) {
        const order = await tx.order.findUniqueOrThrow({ where: { id: refund.originalPayment.orderId } });
        const paidAfter = Math.max(0, amountOf(order.paidAmount) - amountOf(refund.amount));
        const before = metadata(order.metadata);
        await tx.order.update({ where: { id: order.id }, data: { paidAmount: paidAfter, paymentStatus: paidAfter >= amountOf(order.totalAmount) ? "PAID" : paidAfter > 0 ? "PARTIAL" : "UNPAID", metadata: { ...before, lastMpesaRefundId: refund.id, lastMpesaRefundAt: new Date().toISOString(), lastMpesaRefundAmount: amountOf(refund.amount) } } });
      } else if (refund.originalPayment.websiteOrderId) {
        const order = await tx.websiteOrder.findUniqueOrThrow({ where: { id: refund.originalPayment.websiteOrderId } });
        const before = metadata(order.metadata);
        const paidAfter = Math.max(0, amountOf(before.amountPaid) - amountOf(refund.amount));
        await tx.websiteOrder.update({ where: { id: order.id }, data: { metadata: { ...before, amountPaid: paidAfter, mpesaPaymentStatus: paidAfter > 0 ? "PARTIAL" : "REFUNDED", lastMpesaRefundId: refund.id, lastMpesaRefundAt: new Date().toISOString(), lastMpesaRefundAmount: amountOf(refund.amount) } } });
      }
    }
    await tx.actionLog.create({ data: { actorId: refund.authorizedById || refund.requestedById, entity: "MpesaRefund", entityId: refund.id, action: succeeded ? "CONFIRM_MOBILE_MONEY_REFUND" : "FAIL_MOBILE_MONEY_REFUND", before: json({ status: "PROCESSING" }), after: json({ status: succeeded ? "SUCCESS" : "FAILED", amount: amountOf(refund.amount), originalPaymentId: refund.originalPaymentId, providerResultCode: result.code, providerResultDesc: result.description }) } });
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
