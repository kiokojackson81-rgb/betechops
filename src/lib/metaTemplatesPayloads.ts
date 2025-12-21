import { TemplateData } from './metaTemplates';

/**
 * Helpers to build Graph API `messages` payloads for the approved templates.
 * These produce ready-to-send JSON bodies (not the HTTP headers).
 */

export function buildCustomerReceiptPayload(toPhone: string, data: TemplateData) {
  return {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template: {
      name: 'customer_receipt',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(data.customerName ?? '') },
            { type: 'text', text: String(data.receiptNumber ?? '') },
            { type: 'text', text: String(data.total ?? '') },
            { type: 'text', text: String(data.itemsCount ?? '') },
            { type: 'text', text: String(data.paymentMethod ?? '') },
            { type: 'text', text: String(data.companyName ?? '') },
          ],
        },
      ],
    },
  };
}

export function buildAdminDailySummaryPayload(toPhone: string, data: TemplateData) {
  return {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template: {
      name: 'admin_daily_summary',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(data.attendantName ?? '') },
            { type: 'text', text: String(data.date ?? '') },
            { type: 'text', text: String(data.totalSales ?? '') },
            { type: 'text', text: String(data.totalProfit ?? '') },
            { type: 'text', text: String(data.totalReceipts ?? '') },
            { type: 'text', text: String(data.totalItems ?? '') },
          ],
        },
      ],
    },
  };
}

export function buildSupportAcknowledgementPayload(toPhone: string, data: TemplateData) {
  return {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template: {
      name: 'support_acknowledgement',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(data.attendantName ?? '') },
            { type: 'text', text: String(data.date ?? '') },
            { type: 'text', text: String(data.totalSales ?? '') },
            { type: 'text', text: String(data.totalReceipts ?? '') },
          ],
        },
      ],
    },
  };
}

export function buildReceiptReminderPayload(toPhone: string, data: TemplateData) {
  return {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template: {
      name: 'receipt_reminder',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(data.customerName ?? '') },
            { type: 'text', text: String(data.receiptNumber ?? '') },
          ],
        },
      ],
    },
  };
}

export default {
  buildCustomerReceiptPayload,
  buildAdminDailySummaryPayload,
  buildSupportAcknowledgementPayload,
  buildReceiptReminderPayload,
};
