import { sendTransactionalSms } from "@/lib/africasTalking";
import { uploadQuotationPdfToBlob } from "@/lib/blob/uploadQuotationPdf";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { pushReceiptToChatrace } from "@/lib/integrations/chatrace";
import { normalizeKenyanPhone } from "@/lib/phone";
import {
  formatQuoteCurrency,
  getQuotePaymentMethodLabel,
  getQuotePaymentTermsLabel,
  parseStoredQuoteProposal,
} from "@/lib/quoteProposal";
import { buildQuoteProposalPdfBuffer } from "@/lib/quoteProposalPdf";
import type { SerializedQuoteRequest } from "@/lib/quoteRequests";

type QuotationNotificationChannel = "email" | "sms" | "whatsapp";

export type QuotationNotificationResult = {
  channel: QuotationNotificationChannel;
  ok: boolean;
  error?: string;
  meta?: Record<string, unknown>;
};

function buildPreparedBy(
  request: SerializedQuoteRequest,
  actor?: { name?: string | null; email?: string | null },
) {
  return {
    team:
      request.assignedAttendant?.name ||
      request.assignedAttendant?.email ||
      actor?.name ||
      actor?.email ||
      "Quotation attendant",
    leadTechnicianName: "Jackson",
    leadTechnicianPhone: "0705663175",
    salesDesk: "0722 151 083",
  };
}

function buildQuoteEmailBody(request: SerializedQuoteRequest) {
  const proposal = parseStoredQuoteProposal(request.quotationData);
  return `
    <div style="font-size:15px;line-height:1.85;color:#334155">
      <p style="margin:0 0 12px">Hello ${request.customerName},</p>
      <p style="margin:0 0 12px">Thank you for your interest in <strong>Betech Solar Solutions</strong>.</p>
      <p style="margin:0 0 18px">We have prepared your quotation as requested. The full quotation PDF is attached to this email, and you can also log in to your account any time to view and download it.</p>

      <div style="padding:18px;border:1px solid #f1e4d3;border-radius:18px;background:#fffdfa">
        <div style="display:inline-block;margin:0 0 12px;padding:8px 14px;border-radius:999px;background:#fff7e7;color:#7a0000;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase">Quotation summary</div>
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="width:100%;border-collapse:collapse">
          ${[
            ["Quotation reference", request.quoteRef],
            ["Quote title", request.quoteTitle || "Betech Solar quotation"],
            ["Phone", request.customerPhone || "-"],
            ["Email", request.customerEmail || "-"],
            ["Location", request.customerLocation || [request.town, request.county].filter(Boolean).join(", ") || "-"],
            ["Subtotal", formatQuoteCurrency(proposal.subtotal)],
            ["Total", formatQuoteCurrency(proposal.total)],
            ["Payment terms", getQuotePaymentTermsLabel(proposal.paymentTerms)],
            ["Payment method", getQuotePaymentMethodLabel(proposal.paymentMethod)],
          ]
            .map(
              ([label, value], index, rows) => `<tr>
                <td style="padding:12px 10px 12px 0;vertical-align:top;font-size:14px;font-weight:800;color:#7a0000;${
                  index === rows.length - 1 ? "" : "border-bottom:1px solid #f7ead8;"
                }">${label}:</td>
                <td style="padding:12px 0 12px 10px;vertical-align:top;font-size:15px;color:#1f2937;text-align:right;${
                  index === rows.length - 1 ? "" : "border-bottom:1px solid #f7ead8;"
                }">${value}</td>
              </tr>`,
            )
            .join("")}
        </table>
      </div>

      ${
        request.quoteMessage
          ? `<div style="margin-top:18px;padding:18px;border:1px solid #f1e4d3;border-radius:18px;background:#fffdfa">
               <div style="display:inline-block;margin:0 0 12px;padding:8px 14px;border-radius:999px;background:#fff7e7;color:#7a0000;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase">Quotation note</div>
               <div style="font-size:15px;line-height:1.85;color:#334155;white-space:pre-wrap">${request.quoteMessage}</div>
             </div>`
          : ""
      }

      <div style="margin-top:18px;padding:18px;border:1px solid #f1e4d3;border-radius:18px;background:#fffdfa">
        <div style="display:inline-block;margin:0 0 12px;padding:8px 14px;border-radius:999px;background:#fff7e7;color:#7a0000;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase">Account portal</div>
        <p style="margin:0 0 12px">Login using your <strong>phone number</strong> to view your quotation details and download your quotation anytime.</p>
        <div><a href="https://www.betech.co.ke/account">https://www.betech.co.ke/account</a></div>
      </div>
    </div>
  `;
}

function buildQuoteEmailText(request: SerializedQuoteRequest) {
  const proposal = parseStoredQuoteProposal(request.quotationData);
  return [
    `Hello ${request.customerName},`,
    "",
    "We have prepared your quotation as requested.",
    "The full quotation PDF is attached to this email.",
    "",
    `Quotation reference: ${request.quoteRef}`,
    `Quote title: ${request.quoteTitle || "Betech Solar quotation"}`,
    `Total: ${formatQuoteCurrency(proposal.total)}`,
    `Payment terms: ${getQuotePaymentTermsLabel(proposal.paymentTerms)}`,
    `Payment method: ${getQuotePaymentMethodLabel(proposal.paymentMethod)}`,
    "",
    "Log in using your phone number to view your quotation details and download it any time:",
    "https://www.betech.co.ke/account",
  ].join("\n");
}

function buildQuoteSms(request: SerializedQuoteRequest) {
  return `Hello ${request.customerName}. We've prepared your quotation as requested. Log in using your phone number to view and download it here: https://www.betech.co.ke/account`;
}

export async function prepareQuotationPdfAssets(
  request: SerializedQuoteRequest,
  actor?: { name?: string | null; email?: string | null },
) {
  const proposal = parseStoredQuoteProposal(request.quotationData);
  const pdfBuffer = await buildQuoteProposalPdfBuffer({
    quoteRef: request.quoteRef,
    quoteTitle: request.quoteTitle || "Betech Solar quotation",
    customerName: request.customerName,
    customerPhone: request.customerPhone,
    customerEmail: request.customerEmail,
    customerLocation:
      request.customerLocation || [request.town, request.county].filter(Boolean).join(", ") || null,
    issuedAtLabel: new Date().toLocaleString("en-KE"),
    items: proposal.items,
    subtotal: proposal.subtotal,
    total: proposal.total,
    discountAmount: proposal.discountAmount,
    paymentMethod: proposal.paymentMethod,
    paymentTerms: proposal.paymentTerms,
    deliveryMode: proposal.deliveryMode,
    installationMode: proposal.installationMode,
    depositAmount: proposal.depositAmount,
    balanceAmount: proposal.balanceAmount,
    quoteMessage: request.quoteMessage,
    warrantyMode: proposal.warrantyMode,
    fullSystemWarranty: proposal.fullSystemWarranty,
    customWarranty: proposal.customWarranty,
    warrantyGeneralNotes: proposal.warrantyGeneralNotes,
    aiWarrantySummary: proposal.aiWarrantySummary,
    proposalSections: proposal.proposalSections,
    proposalVisibility: proposal.proposalVisibility,
    preparedBy: buildPreparedBy(request, actor),
  });

  const upload = await uploadQuotationPdfToBlob({
    quotationId: request.id,
    quoteRef: request.quoteRef,
    buffer: pdfBuffer,
  });

  return { proposal, pdfBuffer, pdfUrl: upload.url, blobKey: upload.key };
}

export async function deliverQuotationNotifications(
  request: SerializedQuoteRequest,
  opts: {
    pdfBuffer: Buffer;
    pdfUrl: string;
    sendEmail?: boolean;
    sendSms?: boolean;
    triggerWhatsapp?: boolean;
  },
) {
  const notifications: QuotationNotificationResult[] = [];
  const normalizedPhone = normalizeKenyanPhone(request.customerPhone || "");

  if (opts.triggerWhatsapp && normalizedPhone && opts.pdfUrl) {
    try {
      const proposal = parseStoredQuoteProposal(request.quotationData);
      const chatrace = await pushReceiptToChatrace({
        phoneE164: normalizedPhone,
        customerName: request.customerName,
        receiptNumber: request.quoteRef,
        amount: String(proposal.total || 0),
        currency: "KES",
        receiptLink: opts.pdfUrl,
        receiptUrl: opts.pdfUrl,
        tagName: "quotation_ready",
        skipDefaultTags: true,
        extraFields: {
          customer_name: request.customerName,
          receipt_url: opts.pdfUrl,
        },
      });

      notifications.push({
        channel: "whatsapp",
        ok: chatrace.ok,
        error: chatrace.ok ? undefined : String(chatrace.debug?.error || "Chatrace sync failed."),
        meta: {
          normalizedPhone,
          pdfUrl: opts.pdfUrl,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chatrace sync failed.";
      console.error("[quotation.chatrace.failed]", {
        quoteRequestId: request.id,
        quoteRef: request.quoteRef,
        normalizedPhone,
        error: message,
      });
      notifications.push({ channel: "whatsapp", ok: false, error: message });
    }
  }

  if (opts.sendSms && normalizedPhone) {
    try {
      await sendTransactionalSms(normalizedPhone, buildQuoteSms(request));
      notifications.push({ channel: "sms", ok: true, meta: { normalizedPhone } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send SMS.";
      console.error("[quotation.sms.failed]", {
        quoteRequestId: request.id,
        quoteRef: request.quoteRef,
        normalizedPhone,
        error: message,
      });
      notifications.push({ channel: "sms", ok: false, error: message });
    }
  }

  if (opts.sendEmail && request.customerEmail) {
    try {
      await sendGeneralCustomerNotificationEmail({
        to: request.customerEmail,
        subject: `${request.quoteTitle || "Your Betech Solar quotation"} • ${request.quoteRef}`,
        title: request.quoteTitle || "Your solar quotation is ready",
        intro: `Quotation reference: ${request.quoteRef}`,
        bodyHtml: buildQuoteEmailBody(request),
        bodyText: buildQuoteEmailText(request),
        ctaLabel: "Login to your account",
        ctaUrl: "https://www.betech.co.ke/account",
        outro: "You can continue following up from your Betech account anytime.",
        attachments: [
          {
            filename: `${request.quoteRef}.pdf`,
            content: opts.pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      notifications.push({ channel: "email", ok: true, meta: { to: request.customerEmail } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send email.";
      console.error("[quotation.email.failed]", {
        quoteRequestId: request.id,
        quoteRef: request.quoteRef,
        to: request.customerEmail,
        error: message,
      });
      notifications.push({ channel: "email", ok: false, error: message });
    }
  }

  return notifications;
}
