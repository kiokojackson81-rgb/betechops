import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { normalizeKenyanPhone } from "@/lib/phone";
import {
  hasWhatsAppConfig,
  sendWhatsAppTextMessage,
} from "@/lib/notifications/whatsapp";

export type LppReminderNotificationContext = {
  reference: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  productName: string | null;
  dueDate: Date;
  reminderType: string;
  agreedTotal: number;
  totalPaid: number;
  balance: number;
  currency: string;
};

export type LppReminderChannel = "WHATSAPP" | "SMS" | "EMAIL";

export type LppReminderDeliveryResult = {
  channel: LppReminderChannel;
  status: "SENT" | "FAILED" | "SKIPPED";
  providerMessageId: string | null;
  error: string | null;
  payloadSnapshot: Record<string, unknown>;
};

function formatCurrency(amount: number, currency: string) {
  const normalizedCurrency = currency === "KES" ? "KES" : currency || "KES";
  const formatted = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
  return normalizedCurrency === "KES" ? formatted.replace("KES", "KSh") : formatted;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(value);
}

function isValidEmail(value: string | null | undefined) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getNormalizedPhone(phone: string | null | undefined) {
  return normalizeKenyanPhone(phone || "") || null;
}

function getWhatsAppPhone(phone: string | null | undefined) {
  const normalized = getNormalizedPhone(phone);
  if (!normalized) return null;
  return normalized.startsWith("+") ? normalized.slice(1) : normalized;
}

function buildReminderLead(reminderType: string, dueDate: Date) {
  const dueDateLabel = formatDate(dueDate);
  switch (String(reminderType).toUpperCase()) {
    case "REMINDER_7_DAYS":
      return `Your Lipa Pole Pole balance is due on ${dueDateLabel}, which is in 7 days.`;
    case "REMINDER_3_DAYS":
      return `Your Lipa Pole Pole balance is due on ${dueDateLabel}, which is in 3 days.`;
    case "DUE_TODAY":
      return `Your Lipa Pole Pole balance is due today, ${dueDateLabel}.`;
    case "OVERDUE_1_DAY":
      return `Your Lipa Pole Pole balance became overdue on ${dueDateLabel}.`;
    case "OVERDUE_3_DAYS":
      return `Your Lipa Pole Pole balance is now 3 days overdue since ${dueDateLabel}.`;
    case "OVERDUE_7_DAYS":
      return `Your Lipa Pole Pole balance is now 7 days overdue since ${dueDateLabel}.`;
    case "OVERDUE_14_DAYS":
      return `Your Lipa Pole Pole balance is now 14 days overdue since ${dueDateLabel}.`;
    default:
      return `Your Lipa Pole Pole balance is due on ${dueDateLabel}.`;
  }
}

function buildReminderSms(context: LppReminderNotificationContext) {
  return [
    `Hello ${context.customerName || "Customer"},`,
    `${buildReminderLead(context.reminderType, context.dueDate)}`,
    `Reference: ${context.reference}.`,
    context.productName ? `Product: ${context.productName}.` : null,
    `Paid: ${formatCurrency(context.totalPaid, context.currency)}.`,
    `Balance: ${formatCurrency(context.balance, context.currency)}.`,
    "Please clear the balance or contact Betech if you need assistance.",
    "- Betech Solar Solutions",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildReminderEmailHtml(context: LppReminderNotificationContext) {
  return `
    <div style="font-size:15px;line-height:1.8;color:#334155">
      <p style="margin:0 0 12px">Hello ${context.customerName || "Customer"},</p>
      <p style="margin:0 0 12px">${buildReminderLead(context.reminderType, context.dueDate)}</p>
      <p style="margin:0 0 12px">
        <strong>Reference:</strong> ${context.reference}<br />
        ${context.productName ? `<strong>Product:</strong> ${context.productName}<br />` : ""}
        <strong>Total Agreed:</strong> ${formatCurrency(context.agreedTotal, context.currency)}<br />
        <strong>Total Paid:</strong> ${formatCurrency(context.totalPaid, context.currency)}<br />
        <strong>Outstanding Balance:</strong> ${formatCurrency(context.balance, context.currency)}<br />
        <strong>Due Date:</strong> ${formatDate(context.dueDate)}
      </p>
      <p style="margin:0">
        Please clear the balance or reply to this email if you need assistance from our team.
      </p>
    </div>
  `;
}

function buildReminderEmailText(context: LppReminderNotificationContext) {
  return [
    `Hello ${context.customerName || "Customer"},`,
    "",
    buildReminderLead(context.reminderType, context.dueDate),
    `Reference: ${context.reference}`,
    context.productName ? `Product: ${context.productName}` : null,
    `Total Agreed: ${formatCurrency(context.agreedTotal, context.currency)}`,
    `Total Paid: ${formatCurrency(context.totalPaid, context.currency)}`,
    `Outstanding Balance: ${formatCurrency(context.balance, context.currency)}`,
    `Due Date: ${formatDate(context.dueDate)}`,
    "",
    "Please clear the balance or reply to this email if you need assistance from our team.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendLppReminderNotifications(
  context: LppReminderNotificationContext,
): Promise<LppReminderDeliveryResult[]> {
  return Promise.all([
    sendLppReminderChannelNotification(context, "SMS"),
    sendLppReminderChannelNotification(context, "WHATSAPP"),
    sendLppReminderChannelNotification(context, "EMAIL"),
  ]);
}

export async function sendLppReminderChannelNotification(
  context: LppReminderNotificationContext,
  channel: LppReminderChannel,
): Promise<LppReminderDeliveryResult> {
  const smsBody = buildReminderSms(context);
  const emailSubject = `Lipa Pole Pole reminder - ${context.reference}`;
  const normalizedPhone = getNormalizedPhone(context.customerPhone);
  const whatsappPhone = getWhatsAppPhone(context.customerPhone);
  const email = String(context.customerEmail || "").trim();

  if (channel === "SMS") {
    if (!normalizedPhone) {
      return {
        channel,
        status: "SKIPPED",
        providerMessageId: null,
        error: "missing_phone",
        payloadSnapshot: { provider: "africasTalking" },
      };
    }
    try {
      const response = (await sendTransactionalSms(normalizedPhone, smsBody)) as {
        SMSMessageData?: { Recipients?: Array<{ messageId?: string }> };
      };
      return {
        channel,
        status: "SENT",
        providerMessageId: response.SMSMessageData?.Recipients?.[0]?.messageId ?? null,
        error: null,
        payloadSnapshot: { provider: "africasTalking", providerResponse: response },
      };
    } catch (error) {
      return {
        channel,
        status: "FAILED",
        providerMessageId: null,
        error: error instanceof Error ? error.message : "sms_send_failed",
        payloadSnapshot: { provider: "africasTalking" },
      };
    }
  }

  if (channel === "WHATSAPP") {
    if (!whatsappPhone) {
      return {
        channel,
        status: "SKIPPED",
        providerMessageId: null,
        error: "missing_phone",
        payloadSnapshot: { provider: "whatsapp_business" },
      };
    }
    if (!hasWhatsAppConfig()) {
      return {
        channel,
        status: "SKIPPED",
        providerMessageId: null,
        error: "missing_whatsapp_config",
        payloadSnapshot: { provider: "whatsapp_business" },
      };
    }
    try {
      const response = (await sendWhatsAppTextMessage({
        to: whatsappPhone,
        body: smsBody,
      })) as { messages?: Array<{ id?: string }> };
      return {
        channel,
        status: "SENT",
        providerMessageId: response.messages?.[0]?.id ?? null,
        error: null,
        payloadSnapshot: { provider: "whatsapp_business", providerResponse: response },
      };
    } catch (error) {
      return {
        channel,
        status: "FAILED",
        providerMessageId: null,
        error: error instanceof Error ? error.message : "whatsapp_send_failed",
        payloadSnapshot: { provider: "whatsapp_business" },
      };
    }
  }

  if (!isValidEmail(email)) {
    return {
      channel,
      status: "SKIPPED",
      providerMessageId: null,
      error: "missing_or_invalid_email",
      payloadSnapshot: { provider: "email" },
    };
  }

  try {
    const response = await sendGeneralCustomerNotificationEmail({
      to: email,
      subject: emailSubject,
      title: "Lipa Pole Pole payment reminder",
      intro: `Reference: ${context.reference}`,
      bodyHtml: buildReminderEmailHtml(context),
      bodyText: buildReminderEmailText(context),
      outro: "Kind regards,\nBetech Solar Solutions",
    });
    return {
      channel,
      status: "SENT",
      providerMessageId: typeof response?.messageId === "string" ? response.messageId : null,
      error: null,
      payloadSnapshot: { provider: "email", providerResponse: response },
    };
  } catch (error) {
    return {
      channel,
      status: "FAILED",
      providerMessageId: null,
      error: error instanceof Error ? error.message : "email_send_failed",
      payloadSnapshot: { provider: "email" },
    };
  }
}
