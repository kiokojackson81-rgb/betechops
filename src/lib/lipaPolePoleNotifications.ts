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

export type LppLifecycleEvent =
  | "ACCOUNT_CREATED"
  | "PAYMENT_SUBMITTED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_REJECTED"
  | "PAYMENT_REVERSED"
  | "PLAN_COMPLETED"
  | "PRODUCT_RELEASED";

export type LppLifecycleRecipient = "CUSTOMER" | "ASSIGNED_AGENT";

export type LppLifecycleNotificationContext = {
  event: LppLifecycleEvent;
  recipient: LppLifecycleRecipient;
  reference: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  agentName: string | null;
  agentPhone: string | null;
  agentEmail: string | null;
  productName: string | null;
  dueDate: Date | null;
  agreedTotal: number;
  totalPaid: number;
  balance: number;
  currency: string;
  paymentAmount?: number | null;
  paymentReference?: string | null;
  reason?: string | null;
  nextInstallmentDate?: Date | null;
  nextInstallmentAmount?: number | null;
  accountUrl: string;
  adminUrl: string;
};

function formatCurrency(amount: number, currency: string) {
  const normalizedCurrency = currency === "KES" ? "KES" : currency || "KES";
  const formatted = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
  return normalizedCurrency === "KES"
    ? formatted.replace("KES", "KSh")
    : formatted;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(value);
}

function escapeHtml(value: string | null | undefined) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function lifecycleLead(context: LppLifecycleNotificationContext) {
  const amount = formatCurrency(context.paymentAmount || 0, context.currency);
  switch (context.event) {
    case "ACCOUNT_CREATED":
      return `Your Lipa Pole Pole booking ${context.reference} has been created successfully.`;
    case "PAYMENT_SUBMITTED":
      return `Your payment of ${amount} for ${context.reference} has been submitted and is awaiting verification.`;
    case "PAYMENT_RECEIVED":
      return `We have received your payment of ${amount} for ${context.reference}.`;
    case "PAYMENT_VERIFIED":
      return `Your payment of ${amount} for ${context.reference} has been verified.`;
    case "PAYMENT_REJECTED":
      return `Your submitted payment of ${amount} for ${context.reference} could not be verified.`;
    case "PAYMENT_REVERSED":
      return `A payment of ${amount} on ${context.reference} has been reversed.`;
    case "PLAN_COMPLETED":
      return `Congratulations. Your Lipa Pole Pole plan ${context.reference} is fully paid.`;
    case "PRODUCT_RELEASED":
      return `The product for Lipa Pole Pole plan ${context.reference} has been released successfully.`;
  }
}

function lifecycleSubject(context: LppLifecycleNotificationContext) {
  const labels: Record<LppLifecycleEvent, string> = {
    ACCOUNT_CREATED: "Lipa Pole Pole booking confirmed",
    PAYMENT_SUBMITTED: "Lipa Pole Pole payment awaiting verification",
    PAYMENT_RECEIVED: "Lipa Pole Pole payment received",
    PAYMENT_VERIFIED: "Lipa Pole Pole payment verified",
    PAYMENT_REJECTED: "Lipa Pole Pole payment needs attention",
    PAYMENT_REVERSED: "Lipa Pole Pole payment reversed",
    PLAN_COMPLETED: "Lipa Pole Pole plan fully paid",
    PRODUCT_RELEASED: "Lipa Pole Pole product released",
  };
  return `${labels[context.event]} - ${context.reference}`;
}

function nextPaymentText(context: LppLifecycleNotificationContext) {
  if (context.balance <= 0) return null;
  if (context.nextInstallmentDate && context.nextInstallmentAmount) {
    return `Next payment: ${formatCurrency(context.nextInstallmentAmount, context.currency)} by ${formatDate(context.nextInstallmentDate)}.`;
  }
  if (context.dueDate)
    return `Completion date: ${formatDate(context.dueDate)}.`;
  return null;
}

function buildLifecycleCustomerSms(context: LppLifecycleNotificationContext) {
  return [
    `Hello ${context.customerName || "Customer"},`,
    lifecycleLead(context),
    context.productName ? `Product: ${context.productName}.` : null,
    context.paymentReference
      ? `Payment ref: ${context.paymentReference}.`
      : null,
    context.reason ? `Reason: ${context.reason}.` : null,
    `Paid: ${formatCurrency(context.totalPaid, context.currency)}.`,
    `Balance: ${formatCurrency(context.balance, context.currency)}.`,
    nextPaymentText(context),
    `View details: ${context.accountUrl}`,
    "- Betech Solar Solutions",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildLifecycleAgentSms(context: LppLifecycleNotificationContext) {
  const action =
    context.event === "PAYMENT_SUBMITTED"
      ? `${context.customerName || "A customer"} submitted ${formatCurrency(context.paymentAmount || 0, context.currency)} for verification.`
      : `New Lipa Pole Pole account ${context.reference} has been assigned to you for ${context.customerName || "a customer"}.`;
  return `Hello ${context.agentName || "Team member"}, ${action} Product: ${context.productName || "Not specified"}. Open: ${context.adminUrl} - BetechOps`;
}

function buildLifecycleEmailHtml(context: LppLifecycleNotificationContext) {
  const lead =
    context.recipient === "ASSIGNED_AGENT"
      ? buildLifecycleAgentSms(context)
      : lifecycleLead(context);
  return `<div style="font-size:15px;line-height:1.8;color:#334155">
    <p style="margin:0 0 12px">Hello ${escapeHtml(context.recipient === "ASSIGNED_AGENT" ? context.agentName || "Team member" : context.customerName || "Customer")},</p>
    <p style="margin:0 0 12px">${escapeHtml(lead)}</p>
    <p style="margin:0 0 12px"><strong>Reference:</strong> ${escapeHtml(context.reference)}<br />
      ${context.productName ? `<strong>Product:</strong> ${escapeHtml(context.productName)}<br />` : ""}
      ${context.paymentAmount ? `<strong>Payment:</strong> ${escapeHtml(formatCurrency(context.paymentAmount, context.currency))}<br />` : ""}
      ${context.paymentReference ? `<strong>Payment reference:</strong> ${escapeHtml(context.paymentReference)}<br />` : ""}
      <strong>Total paid:</strong> ${escapeHtml(formatCurrency(context.totalPaid, context.currency))}<br />
      <strong>Balance:</strong> ${escapeHtml(formatCurrency(context.balance, context.currency))}<br />
      ${context.nextInstallmentDate && context.nextInstallmentAmount ? `<strong>Next payment:</strong> ${escapeHtml(formatCurrency(context.nextInstallmentAmount, context.currency))} by ${escapeHtml(formatDate(context.nextInstallmentDate))}<br />` : ""}
      ${context.reason ? `<strong>Reason:</strong> ${escapeHtml(context.reason)}<br />` : ""}
    </p>
  </div>`;
}

export async function sendLppLifecycleChannelNotification(
  context: LppLifecycleNotificationContext,
  channel: "SMS" | "EMAIL",
): Promise<LppReminderDeliveryResult> {
  const phone =
    context.recipient === "ASSIGNED_AGENT"
      ? context.agentPhone
      : context.customerPhone;
  const email = String(
    context.recipient === "ASSIGNED_AGENT"
      ? context.agentEmail
      : context.customerEmail || "",
  ).trim();
  const normalizedPhone = getNormalizedPhone(phone);
  const smsBody =
    context.recipient === "ASSIGNED_AGENT"
      ? buildLifecycleAgentSms(context)
      : buildLifecycleCustomerSms(context);

  if (channel === "SMS") {
    if (!normalizedPhone)
      return {
        channel,
        status: "SKIPPED",
        providerMessageId: null,
        error: "missing_phone",
        payloadSnapshot: { provider: "africasTalking" },
      };
    try {
      const response = (await sendTransactionalSms(
        normalizedPhone,
        smsBody,
      )) as { SMSMessageData?: { Recipients?: Array<{ messageId?: string }> } };
      return {
        channel,
        status: "SENT",
        providerMessageId:
          response.SMSMessageData?.Recipients?.[0]?.messageId ?? null,
        error: null,
        payloadSnapshot: {
          provider: "africasTalking",
          providerResponse: response,
        },
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

  if (!isValidEmail(email))
    return {
      channel,
      status: "SKIPPED",
      providerMessageId: null,
      error: "missing_or_invalid_email",
      payloadSnapshot: { provider: "email" },
    };
  try {
    const response = await sendGeneralCustomerNotificationEmail({
      to: email,
      subject: lifecycleSubject(context),
      title: lifecycleSubject(context).split(" - ")[0],
      intro: `Reference: ${context.reference}`,
      bodyHtml: buildLifecycleEmailHtml(context),
      bodyText: smsBody,
      ctaLabel:
        context.recipient === "ASSIGNED_AGENT"
          ? "Open in BetechOps"
          : "View payment plan",
      ctaUrl:
        context.recipient === "ASSIGNED_AGENT"
          ? context.adminUrl
          : context.accountUrl,
      outro: "Kind regards,\nBetech Solar Solutions",
    });
    return {
      channel,
      status: "SENT",
      providerMessageId:
        typeof response?.messageId === "string" ? response.messageId : null,
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
      const response = (await sendTransactionalSms(
        normalizedPhone,
        smsBody,
      )) as {
        SMSMessageData?: { Recipients?: Array<{ messageId?: string }> };
      };
      return {
        channel,
        status: "SENT",
        providerMessageId:
          response.SMSMessageData?.Recipients?.[0]?.messageId ?? null,
        error: null,
        payloadSnapshot: {
          provider: "africasTalking",
          providerResponse: response,
        },
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
        payloadSnapshot: {
          provider: "whatsapp_business",
          providerResponse: response,
        },
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
      providerMessageId:
        typeof response?.messageId === "string" ? response.messageId : null,
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
