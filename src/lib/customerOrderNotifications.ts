import { CustomerOrderNotificationChannel, CustomerOrderNotificationEventType, ProjectNotificationStatus } from "@prisma/client";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { hasWhatsAppConfig, sendWhatsAppTextMessage } from "@/lib/notifications/whatsapp";
import { prisma } from "@/lib/prisma";
import { getPublicReceiptDocumentsUrl } from "@/lib/publicReceiptLinks";

type NotificationEvent = keyof typeof CustomerOrderNotificationEventType;
type RecipientContext = {
  websiteOrderId?: string | null;
  receiptId?: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  reference: string;
  total: number;
  paid: number;
  deliveryMethod?: string | null;
  receiptLink?: string | null;
  podDeliveryFee?: number | null;
  pickupStation?: string | null;
  pickupAddress?: string | null;
  agentName?: string | null;
  agentPhone?: string | null;
};

const money = (value: number) => `KSh ${Math.max(0, Number(value || 0)).toLocaleString("en-KE")}`;
const clean = (value: unknown) => String(value || "").trim();
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function messageFor(event: NotificationEvent, context: RecipientContext) {
  const name = context.customerName || "Customer";
  const balance = Math.max(0, context.total - context.paid);
  const link = context.receiptLink ? ` Receipt: ${context.receiptLink}` : "";
  switch (event) {
    case "ORDER_PLACED": return `Hello ${name}, we have received your Betech order ${context.reference} for ${money(context.total)}. We will confirm availability, payment and delivery details shortly.${link}`;
    case "PAYMENT_REQUESTED": return `Hello ${name}, payment of ${money(balance || context.total)} is needed to confirm your Betech order ${context.reference}. Please use your secure payment link or contact us for assistance.`;
    case "PROCESSING": return `Hello ${name}, your Betech order ${context.reference} is confirmed and now being prepared. We will update you when it is dispatched.`;
    case "DISPATCHED": return context.deliveryMethod === "Pay on Delivery"
      ? `Hello ${name}, your Pay on Delivery order ${context.reference} has been dispatched. Expect it within 1-3 days. Pickup: ${context.pickupStation || "Speedaf collection point"}${context.pickupAddress ? `, ${context.pickupAddress}` : ""}. View pickup information, receipt and order status here: ${context.receiptLink || "contact Betech"}. For help call ${context.agentName || "Betech Customer Care"}${context.agentPhone ? ` on ${context.agentPhone}` : ""}.`
      : `Hello ${name}, your Betech order ${context.reference} has been dispatched. Delivery method: ${context.deliveryMethod || "delivery"}. Amount due: ${money(balance)}. We will contact you with delivery details.`;
    case "PAYMENT_CONFIRMED": return `Hello ${name}, we have received ${money(context.paid)} for Betech order ${context.reference}. Remaining balance: ${money(balance)}.${link}`;
    case "DELIVERED": return `Hello ${name}, your Betech order ${context.reference} has been marked delivered. Thank you for choosing Betech Solar Solutions.${link}`;
    case "DELIVERY_FAILED": return `Hello ${name}, we could not complete delivery for Betech order ${context.reference}. Please contact us to arrange a new delivery time.`;
    case "CANCELLED": return `Hello ${name}, Betech order ${context.reference} has been cancelled. If you made a payment, our team will contact you about the refund or credit process.`;
    case "POD_ORDER_RECEIVED": return `Hello ${name}, we have received your Pay on Delivery order ${context.reference} for ${money(context.total)}. We will contact you when it is ready for dispatch.`;
    case "POD_PAID": return `Hello ${name}, payment of ${money(context.paid)} for your Pay on Delivery order ${context.reference} has been recorded. Remaining balance: ${money(balance)}.${link}`;
    case "POD_DELIVERED": return `Hello ${name}, your Pay on Delivery order ${context.reference} has been delivered. Thank you for choosing Betech Solar Solutions.${link}`;
  }
}

async function sendOne(input: { context: RecipientContext; event: NotificationEvent; channel: CustomerOrderNotificationChannel; force?: boolean }) {
  const { context, event, channel, force } = input;
  const recipient = channel === "EMAIL" ? clean(context.customerEmail) : clean(context.customerPhone);
  const baseKey = `${context.websiteOrderId || context.receiptId}:${event}:${channel}`;
  const idempotencyKey = force ? `${baseKey}:manual:${Date.now()}` : baseKey;
  if (!recipient) return { channel, status: "SKIPPED" as const, reason: "missing_recipient" };

  const payload = { event, reference: context.reference, total: context.total, paid: context.paid, receiptLink: context.receiptLink };
  const log = await prisma.customerOrderNotificationLog.upsert({
    where: { idempotencyKey },
    create: { websiteOrderId: context.websiteOrderId || null, receiptId: context.receiptId || null, eventType: event as CustomerOrderNotificationEventType, channel, recipientName: context.customerName, recipientAddress: recipient, idempotencyKey, status: ProjectNotificationStatus.PENDING, payloadSnapshot: payload },
    update: {},
  });
  if (!force && log.status === ProjectNotificationStatus.SENT) return { channel, status: "SKIPPED" as const, reason: "already_sent" };
  const claimed = await prisma.customerOrderNotificationLog.updateMany({
    where: { id: log.id, status: { in: [ProjectNotificationStatus.PENDING, ProjectNotificationStatus.FAILED] } },
    data: { status: ProjectNotificationStatus.PROCESSING, attemptCount: { increment: 1 }, errorMessage: null, failedAt: null },
  });
  if (!claimed.count) return { channel, status: "SKIPPED" as const, reason: "already_processing" };

  const body = messageFor(event, context);
  try {
    let providerMessageId: string | null = null;
    if (channel === "SMS") {
      const response = await sendTransactionalSms(recipient, body) as any;
      providerMessageId = response?.SMSMessageData?.Recipients?.[0]?.messageId || null;
    } else if (channel === "WHATSAPP") {
      if (!hasWhatsAppConfig()) throw new Error("WhatsApp Business configuration is missing");
      const response = await sendWhatsAppTextMessage({ to: recipient, body, previewUrl: Boolean(context.receiptLink) }) as any;
      providerMessageId = response?.messages?.[0]?.id || null;
    } else {
      await sendGeneralCustomerNotificationEmail({ to: recipient, subject: `Betech order update: ${context.reference}`, title: "Your Betech order update", intro: `Hello ${context.customerName || "Customer"},`, bodyHtml: `<p>${body}</p>`, bodyText: body, ctaLabel: context.receiptLink ? "View receipt" : undefined, ctaUrl: context.receiptLink || undefined });
    }
    await prisma.customerOrderNotificationLog.update({ where: { id: log.id }, data: { status: ProjectNotificationStatus.SENT, providerMessageId, sentAt: new Date() } });
    return { channel, status: "SENT" as const };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.customerOrderNotificationLog.update({ where: { id: log.id }, data: { status: ProjectNotificationStatus.FAILED, errorMessage, failedAt: new Date() } });
    return { channel, status: "FAILED" as const, reason: errorMessage };
  }
}

async function publish(context: RecipientContext, event: NotificationEvent, force?: boolean) {
  const results = await Promise.all([
    sendOne({ context, event, channel: "SMS", force }),
    sendOne({ context, event, channel: "WHATSAPP", force }),
    sendOne({ context, event, channel: "EMAIL", force }),
  ]);
  return { event, results };
}

export async function notifyWebsiteOrderCustomer(input: { websiteOrderId: string; event: NotificationEvent; force?: boolean }) {
  const order = await prisma.websiteOrder.findUnique({ where: { id: input.websiteOrderId }, select: { id: true, orderRef: true, customerName: true, customerPhone: true, customerEmail: true, total: true, deliveryMethod: true, receiptId: true, metadata: true, receipt: { select: { data: true } } } });
  if (!order) return null;
  const metadata = asRecord(order.metadata);
  const receiptData = asRecord(order.receipt?.data);
  const token = clean(receiptData.publicReceiptToken);
  return publish({ websiteOrderId: order.id, receiptId: order.receiptId, customerName: order.customerName, customerPhone: order.customerPhone, customerEmail: order.customerEmail, reference: order.orderRef, total: Number(order.total), paid: Number(metadata.amountPaid ?? metadata.amountPaidNow ?? 0), deliveryMethod: order.deliveryMethod, receiptLink: token ? `https://www.betech.co.ke/r/${token}/view` : null }, input.event, input.force);
}

export async function notifyPodCustomer(input: { receiptId: string; event: Extract<NotificationEvent, "POD_ORDER_RECEIVED" | "POD_PAID" | "POD_DELIVERED" | "DELIVERY_FAILED" | "DISPATCHED">; force?: boolean }) {
  const receipt = await prisma.receipt.findUnique({ where: { id: input.receiptId }, select: { id: true, receiptNumber: true, data: true, order: { select: { orderNumber: true, customerName: true, customerPhone: true, customerEmail: true, totalAmount: true, paidAmount: true } } } });
  if (!receipt?.order) return null;
  const data = asRecord(receipt.data);
  const pod = asRecord(data.podDelivery);
  const token = clean(data.publicReceiptToken);
  const receiptLink = token
    ? `https://www.betech.co.ke/r/${token}/view`
    : input.event === "DISPATCHED"
      ? await getPublicReceiptDocumentsUrl(receipt.id)
      : null;
  const pickup = asRecord(pod.pickup);
  const total = Number(receipt.order.totalAmount);
  const agentPhone = pod.dispatchedByPhoneSource === "ONE_VOICE" ? clean(pod.dispatchedByPhone) : null;
  return publish({ receiptId: receipt.id, customerName: receipt.order.customerName, customerPhone: receipt.order.customerPhone, customerEmail: receipt.order.customerEmail, reference: receipt.order.orderNumber || receipt.receiptNumber || receipt.id, total, paid: pod.paidAt ? total : Number(receipt.order.paidAmount), deliveryMethod: "Pay on Delivery", receiptLink, podDeliveryFee: Number(pod.deliveryFee || 0), pickupStation: clean(pickup.stationName), pickupAddress: clean(pickup.address), agentName: clean(pod.dispatchedByName), agentPhone }, input.event, input.force);
}
