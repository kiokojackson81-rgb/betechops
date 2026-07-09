import "server-only";

import fs from "fs/promises";
import path from "path";
import { buildQuotationHtml } from "@/lib/buildQuotationHtml";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { type QuotePdfInput as CompactQuotePdfInput } from "@/lib/normalizeQuotePdfData";
import type {
  QuoteFeeMode,
  QuotePaymentMethod,
  QuotePaymentTerms,
  QuoteWarrantyMode,
  StoredQuoteLineItem,
} from "@/lib/quoteProposal";

export type QuotePdfInput = {
  quoteRef: string;
  quoteTitle?: string | null;
  issuedAtLabel?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerLocation?: string | null;
  items: StoredQuoteLineItem[];
  subtotal?: number;
  total?: number;
  discountAmount?: number | null;
  paymentMethod?: QuotePaymentMethod | null;
  paymentTerms?: QuotePaymentTerms | null;
  deliveryMode?: QuoteFeeMode | null;
  installationMode?: QuoteFeeMode | null;
  depositAmount?: number | null;
  balanceAmount?: number | null;
  quoteMessage?: string | null;
  warrantyMode?: QuoteWarrantyMode | null;
  fullSystemWarranty?: string | null;
  customWarranty?: string | null;
  warrantyGeneralNotes?: string | null;
  aiWarrantySummary?: string | null;
  proposalSections?: Record<string, string | null> | null;
  proposalVisibility?: Record<string, boolean> | null;
};

function firstUrl(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) continue;
    const match = text.match(/https?:\/\/[^\s)]+/i);
    if (match?.[0]) return match[0];
  }
  return null;
}

function normalizeWarrantyText(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^0+(?:\.0+)?\s*(years?|months?)?$/i.test(text)) return null;
  return text;
}

async function loadImageAsDataUrl(filePath: string) {
  try {
    const buffer = await fs.readFile(path.join(process.cwd(), filePath));
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".svg" ? "image/svg+xml" : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function mapToCompactInput(input: QuotePdfInput): CompactQuotePdfInput {
  return {
    quoteRef: input.quoteRef,
    title: input.quoteTitle || null,
    customer: {
      name: input.customerName,
      phone: input.customerPhone || "",
      email: input.customerEmail || null,
      location: input.customerLocation || null,
    },
    items: (input.items || []).map((item) => ({
      name: item.itemName,
      description: item.description || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      warrantyText:
        normalizeWarrantyText(item.warranty) ||
        (typeof item.warrantyPeriod === "number" && item.warrantyPeriod > 0
          ? `${item.warrantyPeriod} ${item.warrantyUnit === "MONTHS" ? "Months" : "Years"}`
          : null),
    })),
    subtotal: input.subtotal ?? null,
    grandTotal: input.total ?? null,
    discountAmount: input.discountAmount ?? null,
    customerNotes: input.quoteMessage || null,
    similarProjectUrl: firstUrl(
      input.proposalSections?.projectReferenceLinks,
      input.proposalSections?.similarProjects,
    ),
    similarProjectLabel:
      input.proposalSections?.similarProjects ||
      input.proposalSections?.projectReferenceLinks ||
      null,
    warrantyMode:
      input.warrantyMode === "FULL_SYSTEM" || input.warrantyMode === "CUSTOM"
        ? "WHOLE_QUOTATION"
        : "PER_ITEM",
    wholeWarrantyText: input.fullSystemWarranty || input.customWarranty || null,
    paymentStructure:
      input.paymentTerms === "APPROVED_AFTER_INSTALLATION"
        ? "APPROVED_AFTER_INSTALLATION"
        : input.paymentTerms === "DEPOSIT_AND_BALANCE"
          ? "DEPOSIT_AND_BALANCE"
          : "FULL_PAYMENT",
    deliveryMode: input.deliveryMode || null,
    installationMode: input.installationMode || null,
  };
}

export async function buildQuoteProposalPdfBuffer(input: QuotePdfInput) {
  const letterheadUrl = await loadImageAsDataUrl(path.join("public", "letterhead.jpg"));
  const html = buildQuotationHtml(mapToCompactInput(input), { letterheadUrl });
  const browser = await launchChromiumBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
