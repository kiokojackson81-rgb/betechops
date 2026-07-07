import { randomBytes } from "crypto";
import {
  BETECH_AFTER_SALES_SUPPORT,
  BETECH_COMPANY,
  BETECH_PAYMENT_METHODS,
  BETECH_PREPARED_BY_DEFAULTS,
  BETECH_TERMS,
  BETECH_WARRANTY_NOTES,
} from "@/lib/quoteDefaults";

export type QuotePdfPaymentStructure =
  | "FULL_PAYMENT"
  | "DEPOSIT_AND_BALANCE"
  | "DEPOSIT_BALANCE"
  | "APPROVED_AFTER_INSTALLATION";

export type QuotePdfWarrantyMode = "PER_ITEM" | "WHOLE_QUOTATION" | "FULL_SYSTEM" | "CUSTOM";

export type QuotePdfItemInput = {
  productId?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  warrantyText?: string | null;
};

export type QuotePdfInput = {
  quoteRef?: string;
  title?: string | null;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
    location?: string | null;
  };
  items: QuotePdfItemInput[];
  customerNotes?: string | null;
  warrantyMode?: QuotePdfWarrantyMode;
  wholeWarrantyText?: string | null;
  paymentStructure?: QuotePdfPaymentStructure;
  similarProjectUrl?: string | null;
  similarProjectLabel?: string | null;
  preparedBy?: {
    team?: string;
    leadTechnicianName?: string;
    leadTechnicianPhone?: string;
    salesDesk?: string;
  };
};

export type NormalizedQuotePdfRow = {
  index: number;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  warrantyText: string;
};

export type NormalizedQuotePdfData = {
  quoteRef: string;
  quotationDate: Date;
  quotationDateLabel: string;
  validUntil: Date;
  validUntilLabel: string;
  title: string;
  intro: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    location: string | null;
  };
  preparedBy: {
    team: string;
    leadTechnicianName: string;
    leadTechnicianPhone: string;
    salesDesk: string;
  };
  items: NormalizedQuotePdfRow[];
  subtotal: number;
  grandTotal: number;
  equipmentTotal: number;
  transportTotal: number;
  installationTotal: number;
  projectValue: string;
  deliveryText: string;
  installationText: string;
  paymentStructure: QuotePdfPaymentStructure;
  paymentTermsLabel: string;
  warrantyMode: QuotePdfWarrantyMode;
  warrantyNotes: string[];
  customerNotes: string | null;
  similarProjectUrl: string | null;
  similarProjectLabel: string | null;
  company: typeof BETECH_COMPANY;
  paymentMethods: typeof BETECH_PAYMENT_METHODS;
  afterSalesSupport: readonly string[];
  termsAndConditions: readonly string[];
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatMoney(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `KSh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatDateLong(value: Date): string {
  return value.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(value: Date): string {
  return value.toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateQuoteRef(now: Date) {
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const suffix = randomBytes(3).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  return `BT-QUOTE-${datePart}-${suffix || "AUTO1"}`;
}

function normalizePaymentStructure(
  value: QuotePdfPaymentStructure | null | undefined,
): QuotePdfPaymentStructure {
  if (value === "DEPOSIT_BALANCE") return "DEPOSIT_AND_BALANCE";
  if (value === "DEPOSIT_AND_BALANCE") return value;
  if (value === "APPROVED_AFTER_INSTALLATION") return value;
  return "FULL_PAYMENT";
}

function paymentTermsLabel(value: QuotePdfPaymentStructure) {
  if (value === "DEPOSIT_AND_BALANCE") return "30% deposit, balance after installation";
  if (value === "APPROVED_AFTER_INSTALLATION") return "Full payment after installation (subject to approval)";
  return "Full payment before installation";
}

function sanitizeText(value: string | null | undefined) {
  const text = String(value || "").trim();
  return text || null;
}

function sanitizeUrl(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return null;
}

function inferTitle(inputTitle: string | null | undefined, items: QuotePdfItemInput[]) {
  const cleaned = sanitizeText(inputTitle);
  if (cleaned) return cleaned;
  if (items.length === 1) return `${items[0].name.trim()} Quotation`;
  return "Betech Solar Solutions Quotation";
}

function inferIntro(customerName: string, items: QuotePdfItemInput[]) {
  if (items.length === 1) {
    return `Prepared for ${customerName} for supply of ${items[0].name.trim()}, with warranty guidance and Betech after-sales support.`;
  }
  return `Prepared for ${customerName} for supply of listed products and services, with warranty guidance and Betech after-sales support.`;
}

function splitLineItems(items: QuotePdfItemInput[]) {
  const normalizedRows = items
    .map((item, index) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const amount = quantity * unitPrice;
      return {
        index: index + 1,
        name: String(item.name || "").trim(),
        description: sanitizeText(item.description),
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
        amount: Number.isFinite(amount) ? amount : 0,
        warrantyText: sanitizeText(item.warrantyText) || "Contact Betech Solar for warranty guidance.",
      };
    })
    .filter((item) => item.name);

  const installationTotal = normalizedRows
    .filter((item) => /\b(installation|labor|workmanship|commissioning|testing)\b/i.test(item.name))
    .reduce((sum, item) => sum + item.amount, 0);
  const transportTotal = normalizedRows
    .filter((item) => /\b(transport|delivery|logistics)\b/i.test(item.name))
    .reduce((sum, item) => sum + item.amount, 0);
  const subtotal = normalizedRows.reduce((sum, item) => sum + item.amount, 0);
  const equipmentTotal = Math.max(0, subtotal - installationTotal - transportTotal);

  return {
    rows: normalizedRows,
    subtotal,
    grandTotal: subtotal,
    equipmentTotal,
    transportTotal,
    installationTotal,
  };
}

export function normalizeQuotePdfData(input: QuotePdfInput): NormalizedQuotePdfData {
  const quotationDate = new Date();
  const validUntil = new Date(quotationDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const rows = splitLineItems(input.items || []);
  const customerName = String(input.customer?.name || "").trim() || "Customer";
  const warrantyMode = input.warrantyMode || "PER_ITEM";
  const wholeWarrantyText =
    sanitizeText(input.wholeWarrantyText) || "Contact Betech Solar for warranty guidance.";
  const items =
    warrantyMode === "WHOLE_QUOTATION" || warrantyMode === "FULL_SYSTEM"
      ? rows.rows.map((item) => ({ ...item, warrantyText: wholeWarrantyText }))
      : rows.rows;

  return {
    quoteRef: sanitizeText(input.quoteRef) || generateQuoteRef(quotationDate),
    quotationDate,
    quotationDateLabel: formatDateTime(quotationDate),
    validUntil,
    validUntilLabel: formatDateLong(validUntil).toUpperCase(),
    title: inferTitle(input.title, items),
    intro: inferIntro(customerName, items),
    customer: {
      name: customerName,
      phone: String(input.customer?.phone || "").trim(),
      email: sanitizeText(input.customer?.email),
      location: sanitizeText(input.customer?.location),
    },
    preparedBy: {
      team: sanitizeText(input.preparedBy?.team) || BETECH_PREPARED_BY_DEFAULTS.team,
      leadTechnicianName:
        sanitizeText(input.preparedBy?.leadTechnicianName) ||
        BETECH_PREPARED_BY_DEFAULTS.leadTechnicianName,
      leadTechnicianPhone:
        sanitizeText(input.preparedBy?.leadTechnicianPhone) ||
        BETECH_PREPARED_BY_DEFAULTS.leadTechnicianPhone,
      salesDesk:
        sanitizeText(input.preparedBy?.salesDesk) || BETECH_PREPARED_BY_DEFAULTS.salesDesk,
    },
    items,
    subtotal: rows.subtotal,
    grandTotal: rows.grandTotal,
    equipmentTotal: rows.equipmentTotal,
    transportTotal: rows.transportTotal,
    installationTotal: rows.installationTotal,
    projectValue: "100%",
    deliveryText: "1-2 days depending on your location and current workload, to be confirmed.",
    installationText: "1-2 days depending on site conditions.",
    paymentStructure: normalizePaymentStructure(input.paymentStructure),
    paymentTermsLabel: paymentTermsLabel(normalizePaymentStructure(input.paymentStructure)),
    warrantyMode,
    warrantyNotes: [...BETECH_WARRANTY_NOTES],
    customerNotes: sanitizeText(input.customerNotes),
    similarProjectUrl: sanitizeUrl(input.similarProjectUrl),
    similarProjectLabel: sanitizeText(input.similarProjectLabel) || "Watch a similar Betech project",
    company: BETECH_COMPANY,
    paymentMethods: BETECH_PAYMENT_METHODS,
    afterSalesSupport: BETECH_AFTER_SALES_SUPPORT,
    termsAndConditions: BETECH_TERMS,
  };
}
