import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTransactionalSms } from "@/lib/africasTalking";

type JsonRecord = Record<string, unknown>;

const record = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};

const sandboxBaseUrl = "https://cybqa.pesapal.com/pesapalv3";
const liveBaseUrl = "https://pay.pesapal.com/v3";
let tokenCache: { value: string; expiresAt: number } | null = null;

function config() {
  const key = process.env.PESAPAL_CONSUMER_KEY?.trim();
  const secret = process.env.PESAPAL_CONSUMER_SECRET?.trim();
  const ipnId = process.env.PESAPAL_IPN_ID?.trim();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "https://www.betech.co.ke").replace(/\/$/, "");
  const sandbox = (process.env.PESAPAL_ENV || "live").trim().toLowerCase() === "sandbox";
  if (!key || !secret) throw new Error("Pesapal is not configured. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET.");
  return { key, secret, ipnId, siteUrl, baseUrl: sandbox ? sandboxBaseUrl : liveBaseUrl };
}

export function pesapalIsConfigured() {
  return Boolean(process.env.PESAPAL_CONSUMER_KEY?.trim() && process.env.PESAPAL_CONSUMER_SECRET?.trim());
}

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.value;
  const settings = config();
  const response = await fetch(`${settings.baseUrl}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ consumer_key: settings.key, consumer_secret: settings.secret }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (!response.ok || !token) throw new Error(body?.error?.message || body?.message || "Pesapal authentication failed.");
  tokenCache = { value: token, expiresAt: Date.now() + 4 * 60_000 };
  return token;
}

function splitName(value: string) {
  const [first = "Customer", ...rest] = value.trim().split(/\s+/).filter(Boolean);
  return { first, last: rest.join(" ") };
}

async function ipnId() {
  const settings = config();
  if (settings.ipnId) return settings.ipnId;
  const token = await accessToken();
  const ipnUrl = `${settings.siteUrl}/api/payments/pesapal/ipn`;
  const headers = { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const listed = await fetch(`${settings.baseUrl}/api/URLSetup/GetIpnList`, { headers, cache: "no-store" });
  const known = await listed.json().catch(() => []);
  if (Array.isArray(known)) {
    const match = known.find((entry) => String(entry?.url || "").replace(/\/$/, "") === ipnUrl);
    if (typeof match?.ipn_id === "string" && match.ipn_id) return match.ipn_id;
  }
  const registered = await fetch(`${settings.baseUrl}/api/URLSetup/RegisterIPN`, {
    method: "POST", headers, cache: "no-store", body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "GET" }),
  });
  const body = await registered.json().catch(() => ({}));
  if (!registered.ok || typeof body.ipn_id !== "string" || !body.ipn_id) throw new Error(body?.error?.message || "Pesapal could not register the payment notification URL.");
  return body.ipn_id;
}

export async function createPesapalCheckout(input: {
  orderId: string;
  receiptId: string;
  receiptToken: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail?: string | null;
  amount: number;
}) {
  if (!Number.isInteger(input.amount) || input.amount < 1) throw new Error("Enter a whole-KES amount to pay.");
  const settings = config();
  const merchantReference = `PSP-${input.orderId}-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  if (merchantReference.length > 50) throw new Error("Unable to create a safe Pesapal payment reference.");
  const now = new Date().toISOString();
  const order = await prisma.order.findUniqueOrThrow({ where: { id: input.orderId }, select: { metadata: true } });
  const metadata = record(order.metadata);
  await prisma.order.update({
    where: { id: input.orderId },
    data: { metadata: { ...metadata, pesapal: { merchantReference, receiptId: input.receiptId, receiptToken: input.receiptToken, amount: input.amount, status: "PENDING", createdAt: now } } },
  });
  const token = await accessToken();
  const notificationId = await ipnId();
  const name = splitName(input.customerName);
  const callback = `${settings.siteUrl}/api/payments/pesapal/callback`;
  const response = await fetch(`${settings.baseUrl}/api/Transactions/SubmitOrderRequest`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      id: merchantReference,
      currency: "KES",
      amount: input.amount,
      description: `Betech receipt ${input.orderNumber}`.slice(0, 100),
      callback_url: callback,
      cancellation_url: `${settings.siteUrl}/r/${encodeURIComponent(input.receiptToken)}/view`,
      notification_id: notificationId,
      redirect_mode: "TOP_WINDOW",
      billing_address: {
        email_address: input.customerEmail || "payments@betech.co.ke",
        phone_number: input.customerPhone || "",
        country_code: "KE",
        first_name: name.first,
        middle_name: "",
        last_name: name.last,
        line_1: "Betech Solar Solutions", line_2: "", city: "", state: "", postal_code: "", zip_code: "",
      },
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  const redirectUrl = typeof body.redirect_url === "string" ? body.redirect_url : "";
  const trackingId = typeof body.order_tracking_id === "string" ? body.order_tracking_id : null;
  if (!response.ok || !redirectUrl) {
    await prisma.order.update({ where: { id: input.orderId }, data: { metadata: { ...metadata, pesapal: { merchantReference, receiptId: input.receiptId, receiptToken: input.receiptToken, amount: input.amount, status: "FAILED", createdAt: now, error: body?.error?.message || body?.message || "Checkout creation failed" } } } }).catch(() => undefined);
    throw new Error(body?.error?.message || body?.message || "Pesapal could not start checkout.");
  }
  await prisma.order.update({ where: { id: input.orderId }, data: { metadata: { ...metadata, pesapal: { merchantReference, receiptId: input.receiptId, receiptToken: input.receiptToken, amount: input.amount, status: "PENDING", createdAt: now, trackingId, redirectUrl } } } });
  return { merchantReference, trackingId, redirectUrl };
}

export async function settlePesapalPayment(input: { trackingId: string; merchantReference: string }) {
  const match = /^PSP-([A-Za-z0-9]+)-[A-Za-z0-9]+$/.exec(input.merchantReference);
  if (!match) throw new Error("Invalid Pesapal merchant reference.");
  const order = await prisma.order.findUnique({ where: { id: match[1] }, include: { receipt: true } });
  if (!order?.receipt) throw new Error("Pesapal order receipt was not found.");
  const metadata = record(order.metadata);
  const pending = record(metadata.pesapal);
  if (pending.merchantReference !== input.merchantReference) throw new Error("Pesapal payment reference does not match this order.");
  if (pending.status === "COMPLETED") {
    // Older successful callbacks may have completed before the office alert
    // was added. Deliver it on a later IPN/callback without charging or
    // settling the order again.
    await sendPesapalOfficeConfirmation({
      order,
      pending,
      trackingId: input.trackingId,
      merchantReference: input.merchantReference,
    });
    return { completed: true, failed: false, status: "COMPLETED", receiptToken: typeof pending.receiptToken === "string" ? pending.receiptToken : null };
  }
  const token = await accessToken();
  const settings = config();
  const response = await fetch(`${settings.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(input.trackingId)}`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || "Unable to verify the Pesapal payment.");
  const status = String(body.payment_status_description || body.status || "PENDING").trim().toUpperCase();
  const completed = ["COMPLETED", "PAID", "SUCCESS"].includes(status);
  const failed = ["FAILED", "CANCELLED", "INVALID"].includes(status);
  const paidAt = new Date();
  const paidBefore = Number(order.paidAmount || 0);
  const requested = Number(pending.amount || 0);
  const paidAfter = completed ? Math.min(Number(order.totalAmount), paidBefore + requested) : paidBefore;
  const receiptData = record(order.receipt.data);
  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: {
      paidAmount: paidAfter,
      paymentStatus: paidAfter >= Number(order.totalAmount) ? "PAID" : paidAfter > 0 ? "PARTIAL" : order.paymentStatus,
      // A Pesapal result is verified directly with Pesapal before this write.
      // It is therefore a completed payment, not merely a payment attempt.
      status: completed && paidAfter >= Number(order.totalAmount) ? "COMPLETED" : order.status,
      metadata: { ...metadata, pesapal: { ...pending, trackingId: input.trackingId, status: completed ? "COMPLETED" : failed ? "FAILED" : "PENDING", verifiedAt: paidAt.toISOString(), providerStatus: body } },
    } }),
    prisma.receipt.update({ where: { id: order.receipt.id }, data: { data: {
      ...receiptData,
      ...(completed ? { paymentDate: paidAt.toISOString(), lastPesapalPaymentAt: paidAt.toISOString(), lastPesapalTrackingId: input.trackingId, lastPesapalReference: input.merchantReference } : {}),
    } } }),
  ]);
  if (completed) {
    await sendPesapalOfficeConfirmation({
      order,
      pending,
      trackingId: input.trackingId,
      merchantReference: input.merchantReference,
    });
  }
  return { completed, failed, status, receiptToken: typeof pending.receiptToken === "string" ? pending.receiptToken : null };
}

async function sendPesapalOfficeConfirmation(input: {
  order: Awaited<ReturnType<typeof prisma.order.findUnique>> & { receipt: { id: string; receiptNumber: string | null; data: unknown } | null };
  pending: JsonRecord;
  trackingId: string;
  merchantReference: string;
}) {
  if (!input.order?.receipt || input.pending.officeNotificationSentAt) return;
  const officePhone = process.env.BETECH_OFFICE_PHONE?.trim() || "0722151083";
  const amount = Number(input.pending.amount || input.order.totalAmount || 0);
  const receiptNumber = input.order.receipt.receiptNumber || input.order.orderNumber;
  try {
    await sendTransactionalSms(
      officePhone,
      `Pesapal payment received: KSh ${amount.toLocaleString("en-KE")} from ${input.order.customerName || "Customer"} for receipt ${receiptNumber}. Reference: ${input.merchantReference}. Tracking: ${input.trackingId}. Status: completed.`,
    );
    const metadata = record(input.order.metadata);
    const pesapal = record(metadata.pesapal);
    await prisma.order.update({
      where: { id: input.order.id },
      data: {
        metadata: {
          ...metadata,
          pesapal: {
            ...pesapal,
            officeNotificationSentAt: new Date().toISOString(),
            officeNotificationPhone: officePhone,
          },
        },
      },
    });
  } catch (error) {
    // Payment settlement is authoritative and must not be rolled back because
    // an SMS provider is temporarily unavailable. A later callback can retry.
    console.error("[pesapal] office payment confirmation SMS failed", error);
  }
}
