export type TemplateData = Record<string, string | number | undefined>;

export type MetaTemplate = {
  id: string; // internal id for reference
  name: string; // friendly short name
  language: string; // e.g. en_US
  text: string; // template body with placeholders like {{customerName}}
  description?: string;
};

/**
 * Collection of Meta/WhatsApp templates used by the system.
 * Keep texts short and use placeholders that will be replaced server-side
 * before submitting templates for Meta approval where needed.
 */
export const templates: Record<string, MetaTemplate> = {
  customer_receipt: {
    id: "customer_receipt",
    name: "Customer receipt (soft-copy)",
    language: "en_US",
    // soft-copy must not contain stamp/signature — PDF will be attached
    text:
      "Hello {{customerName}},\n\nThank you for your purchase. Your receipt ({{receiptNumber}}) for KES {{total}} is attached.\n\nItems: {{itemsCount}} • Payment: {{paymentMethod}}\n\nIf you have any questions reply to this message.\n\n{{companyName}}",
    description:
      "Sent to customers with the soft-copy PDF attached. Avoids stamp/signature in the PDF.",
  },

  admin_daily_summary: {
    id: "admin_daily_summary",
    name: "Admin daily summary (per attendant)",
    language: "en_US",
    text:
      "Daily report from {{attendantName}} ({{date}}):\nTotal Sales: KES {{totalSales}}\nTotal Profit: KES {{totalProfit}}\nReceipts: {{totalReceipts}}\nItems: {{totalItems}}",
    description:
      "Sent to admin WhatsApp number when a support attendant submits their daily report.",
  },

  support_acknowledgement: {
    id: "support_acknowledgement",
    name: "Support report acknowledgement",
    language: "en_US",
    text:
      "Thanks {{attendantName}} — your support report for {{date}} has been saved.\nTotal Sales: KES {{totalSales}} • Receipts: {{totalReceipts}}",
    description: "Short confirmation sent to the attendant after successful submission.",
  },

  receipt_reminder: {
    id: "receipt_reminder",
    name: "Receipt missing data reminder",
    language: "en_US",
    text:
      "Hi {{customerName}}, we couldn't capture all details for receipt {{receiptNumber}}. Please contact support or reply to this message so we can complete your receipt.",
    description: "Optional: use when receipt data is incomplete and follow-up is needed.",
  },
};

/**
 * Render a template string by replacing {{keys}} with values from `data`.
 * Unprovided placeholders remain untouched so they are visible in approval drafts.
 */
export function renderTemplate(text: string, data: TemplateData): string {
  return text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const val = data[key];
    if (val === undefined || val === null) return `{{${key}}}`;
    return String(val);
  });
}

export function renderTemplateById(id: string, data: TemplateData): string {
  const t = templates[id];
  if (!t) throw new Error(`Unknown template id: ${id}`);
  return renderTemplate(t.text, data);
}

export default templates;
