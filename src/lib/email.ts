import nodemailer from "nodemailer";

type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  disposition?: "attachment" | "inline";
};

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
};

type BrandedTemplateInput = {
  title: string;
  preheader?: string;
  intro?: string;
  bodyHtml: string;
  bodyText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  outro?: string;
};

type BrandedNotificationInput = {
  to: string | string[];
  subject: string;
  title: string;
  intro?: string;
  bodyHtml: string;
  bodyText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  outro?: string;
  attachments?: EmailAttachment[];
};

type ReceiptEmailInput = {
  to: string | string[];
  receiptNumber: string;
  receiptLink?: string | null;
  customerName?: string | null;
  attachments?: EmailAttachment[];
};

type OrderConfirmationEmailInput = {
  to: string | string[];
  orderRef: string;
  customerName?: string | null;
  amountText?: string | null;
  nextSteps?: string | null;
};

type PaymentConfirmationEmailInput = {
  to: string | string[];
  reference: string;
  amountText?: string | null;
  customerName?: string | null;
};

type DeliveryStatusEmailInput = {
  to: string | string[];
  customerName?: string | null;
  reference: string;
  statusLabel: string;
  details?: string | null;
};

const BETECH_EMAIL = "info@betech.co.ke";
const BETECH_NAME = "Betech Solar Solutions";
const BETECH_PHONE_PRIMARY = "+254 722 151 083";
const BETECH_PHONE_SECONDARY = "+254 703 241 917";
const BETECH_WEBSITE = "https://www.betech.co.ke";
const BETECH_TIKTOK = "https://www.tiktok.com/@betechsolarprojects";
const BETECH_BUSINESS_HOURS = [
  "Monday-Friday: 9:00 AM-6:00 PM",
  "Saturday: 9:00 AM-3:00 PM",
  "Sunday/Public Holidays: Closed",
];

let transporterPromise: Promise<ReturnType<typeof nodemailer.createTransport>> | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`[email] Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function getOptionalEnv(name: string) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    return null;
  }
  return String(value).trim();
}

function getEmailConfig() {
  const host = getRequiredEnv("SMTP_HOST");
  const user = getRequiredEnv("SMTP_USER");
  const password = getRequiredEnv("SMTP_PASSWORD");
  const fromEmail = getRequiredEnv("MAIL_FROM_EMAIL");
  const fromName = getRequiredEnv("MAIL_FROM_NAME");
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true";
  const tlsServername = getOptionalEnv("SMTP_TLS_SERVERNAME");
  const tlsRejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false";

  console.log("[email] config", {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    from: process.env.MAIL_FROM_EMAIL,
    hasPassword: Boolean(process.env.SMTP_PASSWORD),
    tlsServername,
    tlsRejectUnauthorized,
  });

  return {
    host,
    port,
    secure,
    user,
    password,
    fromEmail,
    fromName,
    tlsServername,
    tlsRejectUnauthorized,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = Promise.resolve().then(() => {
      const config = getEmailConfig();
      console.log("SMTP_HOST_RUNTIME", process.env.SMTP_HOST);
      return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.password,
        },
        tls: {
          servername: config.tlsServername || undefined,
          rejectUnauthorized: config.tlsRejectUnauthorized,
        },
      });
    });
  }

  return transporterPromise;
}

export function getDefaultEmailIdentity() {
  const config = getEmailConfig();
  return {
    from: `"${config.fromName}" <${config.fromEmail}>`,
    replyTo: config.fromEmail,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
  };
}

export function renderBetechEmailTemplate(input: BrandedTemplateInput) {
  const safeTitle = escapeHtml(input.title);
  const safeIntro = input.intro ? escapeHtml(input.intro) : "";
  const safeOutro = input.outro ? escapeHtml(input.outro) : "";
  const preheader = input.preheader || input.intro || input.title;
  const ctaHtml =
    input.ctaLabel && input.ctaUrl
      ? `<div style="margin:24px 0 0"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#7a0000;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700">${escapeHtml(input.ctaLabel)}</a></div>`
      : "";

  const html = `<!doctype html>
<html>
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,sans-serif;color:#1f2937">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background:#f8f4ec;padding:24px 0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #ead8c4">
            <tr>
              <td style="background:linear-gradient(135deg,#7a0000 0%,#991010 100%);padding:24px 28px;color:#ffffff">
                <div style="font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;opacity:0.92">Betech Solar Solutions</div>
                <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2">${safeTitle}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px">
                ${safeIntro ? `<p style="margin:0 0 18px;font-size:16px;line-height:1.65">${safeIntro}</p>` : ""}
                <div style="font-size:15px;line-height:1.7;color:#334155">${input.bodyHtml}</div>
                ${ctaHtml}
                ${safeOutro ? `<p style="margin:24px 0 0;font-size:15px;line-height:1.65">${safeOutro}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;background:#fff7e7;border-top:1px solid #f4dfbb">
                <div style="font-size:13px;font-weight:700;color:#7a0000;margin-bottom:8px">${BETECH_NAME}</div>
                <div style="font-size:13px;line-height:1.7;color:#475569">
                  <div>Email: <a href="mailto:${BETECH_EMAIL}" style="color:#7a0000">${BETECH_EMAIL}</a></div>
                  <div>Phone: ${BETECH_PHONE_PRIMARY}</div>
                  <div>Alternative phone: ${BETECH_PHONE_SECONDARY}</div>
                  <div>Website: <a href="${BETECH_WEBSITE}" style="color:#7a0000">${BETECH_WEBSITE}</a></div>
                  <div>TikTok projects: <a href="${BETECH_TIKTOK}" style="color:#7a0000">${BETECH_TIKTOK}</a></div>
                  <div style="margin-top:10px;font-weight:700;color:#7a0000">Business hours</div>
                  ${BETECH_BUSINESS_HOURS.map((item) => `<div>${escapeHtml(item)}</div>`).join("")}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    input.title,
    "",
    input.intro || "",
    input.bodyText || normalizeText(input.bodyHtml),
    input.ctaLabel && input.ctaUrl ? `${input.ctaLabel}: ${input.ctaUrl}` : "",
    input.outro || "",
    "",
    BETECH_NAME,
    `Email: ${BETECH_EMAIL}`,
    `Phone: ${BETECH_PHONE_PRIMARY}`,
    `Alternative phone: ${BETECH_PHONE_SECONDARY}`,
    `Website: ${BETECH_WEBSITE}`,
    `TikTok projects: ${BETECH_TIKTOK}`,
    "Business hours:",
    ...BETECH_BUSINESS_HOURS,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export function describeEmailError(error: unknown) {
  if (error instanceof Error) {
    const base = (error.message || "Unknown email error").replace(/password[^,\s]*/gi, "password=[redacted]");
    if (base.includes("Hostname/IP does not match certificate's altnames")) {
      return `${base}. Configure SMTP_TLS_SERVERNAME to the certificate hostname from your mail provider, or update SMTP_HOST to the provider's official SMTP server.`;
    }
    return base;
  }
  return String(error || "Unknown email error");
}

export async function sendEmail(input: SendEmailInput) {
  const transporter = await getTransporter();
  const identity = getDefaultEmailIdentity();

  return transporter.sendMail({
    from: identity.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo || identity.replyTo,
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
      disposition: attachment.disposition || "attachment",
    })),
  });
}

export async function sendCustomerNotificationEmail(input: BrandedNotificationInput) {
  const rendered = renderBetechEmailTemplate({
    title: input.title,
    intro: input.intro,
    bodyHtml: input.bodyHtml,
    bodyText: input.bodyText,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    outro: input.outro,
  });

  return sendEmail({
    to: input.to,
    subject: input.subject,
    html: rendered.html,
    text: rendered.text,
    attachments: input.attachments,
  });
}

export async function sendOtpVerificationEmail(input: { to: string | string[]; code: string; customerName?: string | null }) {
  return sendCustomerNotificationEmail({
    to: input.to,
    subject: "Your Betech Solar verification code",
    title: "Verify your account",
    intro: input.customerName ? `Hello ${input.customerName},` : "Hello,",
    bodyHtml: `<p>Use this verification code to continue signing in to your Betech Solar account:</p><p style="font-size:28px;font-weight:800;letter-spacing:0.3em;color:#7a0000">${escapeHtml(input.code)}</p><p>This code expires shortly. If you did not request it, you can ignore this email.</p>`,
    bodyText: `Use this verification code to continue signing in: ${input.code}. This code expires shortly.`,
  });
}

export async function sendCustomerLoginNotificationEmail(input: { to: string | string[]; customerName?: string | null; methodLabel?: string | null }) {
  return sendCustomerNotificationEmail({
    to: input.to,
    subject: "Betech Solar login alert",
    title: "New account sign-in",
    intro: input.customerName ? `Hello ${input.customerName},` : "Hello,",
    bodyHtml: `<p>Your Betech Solar account was just accessed${input.methodLabel ? ` using ${escapeHtml(input.methodLabel)}` : ""}.</p><p>If this was you, no further action is needed. If you do not recognize this sign-in, contact Betech Solar Solutions immediately.</p>`,
    bodyText: `Your Betech Solar account was just accessed${input.methodLabel ? ` using ${input.methodLabel}` : ""}. If this was not you, contact Betech Solar Solutions immediately.`,
  });
}

export async function sendReceiptEmail(input: ReceiptEmailInput) {
  return sendCustomerNotificationEmail({
    to: input.to,
    subject: `Your Betech Solar receipt ${input.receiptNumber}`,
    title: "Your receipt is ready",
    intro: input.customerName ? `Hello ${input.customerName},` : "Hello,",
    bodyHtml: `<p>Thank you for shopping with Betech Solar Solutions.</p><p>Your receipt number is <strong>${escapeHtml(input.receiptNumber)}</strong>.</p><p>Your receipt PDF is attached to this email.${input.receiptLink ? ` You can also view it here: <a href="${escapeHtml(input.receiptLink)}">${escapeHtml(input.receiptLink)}</a>.` : ""}</p>`,
    bodyText: `Thank you for shopping with Betech Solar Solutions. Your receipt number is ${input.receiptNumber}.${input.receiptLink ? ` View it here: ${input.receiptLink}` : ""}`,
    attachments: input.attachments,
  });
}

export async function sendOrderConfirmationEmail(input: OrderConfirmationEmailInput) {
  return sendCustomerNotificationEmail({
    to: input.to,
    subject: `Order received: ${input.orderRef}`,
    title: "Order confirmation",
    intro: input.customerName ? `Hello ${input.customerName},` : "Hello,",
    bodyHtml: `<p>We have received your Betech Solar order <strong>${escapeHtml(input.orderRef)}</strong>${input.amountText ? ` for <strong>${escapeHtml(input.amountText)}</strong>` : ""}.</p><p>${escapeHtml(input.nextSteps || "Our team will confirm availability, payment, and delivery details shortly.")}</p>`,
    bodyText: `We have received your Betech Solar order ${input.orderRef}${input.amountText ? ` for ${input.amountText}` : ""}. ${input.nextSteps || "Our team will confirm availability, payment, and delivery details shortly."}`,
  });
}

export async function sendPaymentConfirmationEmail(input: PaymentConfirmationEmailInput) {
  return sendCustomerNotificationEmail({
    to: input.to,
    subject: `Payment confirmed: ${input.reference}`,
    title: "Payment confirmed",
    intro: input.customerName ? `Hello ${input.customerName},` : "Hello,",
    bodyHtml: `<p>We have confirmed your payment reference <strong>${escapeHtml(input.reference)}</strong>${input.amountText ? ` for <strong>${escapeHtml(input.amountText)}</strong>` : ""}.</p><p>Our team will continue processing your order and share the next update soon.</p>`,
    bodyText: `We have confirmed your payment reference ${input.reference}${input.amountText ? ` for ${input.amountText}` : ""}. Our team will continue processing your order and share the next update soon.`,
  });
}

export async function sendDeliveryStatusEmail(input: DeliveryStatusEmailInput) {
  return sendCustomerNotificationEmail({
    to: input.to,
    subject: `Delivery update: ${input.reference}`,
    title: "Delivery status update",
    intro: input.customerName ? `Hello ${input.customerName},` : "Hello,",
    bodyHtml: `<p>Your order <strong>${escapeHtml(input.reference)}</strong> is now marked as <strong>${escapeHtml(input.statusLabel)}</strong>.</p>${input.details ? `<p>${escapeHtml(input.details)}</p>` : ""}`,
    bodyText: `Your order ${input.reference} is now marked as ${input.statusLabel}.${input.details ? ` ${input.details}` : ""}`,
  });
}

export async function sendGeneralCustomerNotificationEmail(input: BrandedNotificationInput) {
  return sendCustomerNotificationEmail(input);
}
