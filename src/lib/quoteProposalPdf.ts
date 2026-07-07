import "server-only";

import fs from "fs/promises";
import path from "path";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import {
  formatQuoteCurrency,
  getQuotePaymentMethodLabel,
  getQuotePaymentTermsLabel,
  PAYMENT_METHOD_DETAILS,
  type QuoteProposalSectionKey,
  type QuoteProposalVisibilityKey,
  type QuotePaymentMethod,
  type QuotePaymentTerms,
  type QuoteWarrantyMode,
  type StoredQuoteLineItem,
} from "@/lib/quoteProposal";
import { QUOTATION_COMPANY_DETAILS } from "@/lib/quoteProposalSections";

type QuotePdfInput = {
  quoteRef: string;
  quoteTitle?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerLocation?: string | null;
  issuedAtLabel: string;
  items: StoredQuoteLineItem[];
  subtotal: number;
  total: number;
  paymentMethod?: QuotePaymentMethod | null;
  paymentTerms?: QuotePaymentTerms | null;
  depositAmount?: number | null;
  balanceAmount?: number | null;
  quoteMessage?: string | null;
  warrantyMode?: QuoteWarrantyMode | null;
  fullSystemWarranty?: string | null;
  customWarranty?: string | null;
  warrantyGeneralNotes?: string | null;
  aiWarrantySummary?: string | null;
  proposalSections?: Partial<Record<QuoteProposalSectionKey, string | null>>;
  proposalVisibility?: Partial<Record<QuoteProposalVisibilityKey, boolean>>;
};

type QuotePdfRenderData = {
  subject: string;
  summaryText: string;
  quoteDate: string;
  validUntil: string;
  companyDetails: string[];
  preparedBy: string[];
  projectOverview: string | null;
  priceIncludes: string[];
  whatItCanPower: string[];
  deliveryLines: string[];
  afterSalesSupport: string[];
  importantNotes: string[];
  scopeExclusions: string[];
  termsAndConditions: string[];
  additionalNotes: string[];
  referenceLinks: string[];
  similarProjects: string[];
  paymentSections: Array<{ label: string; lines: string[] }>;
  warrantyRows: Array<{ component: string; warranty: string; notes: string }>;
  warrantyNotes: string[];
  items: StoredQuoteLineItem[];
  solutionCards: Array<{ label: string; value: string }>;
};

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitParagraphLines(value?: string | null) {
  return String(value || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function sanitizeMessageParagraphs(message?: string | null) {
  return splitParagraphLines(message);
}

function formatProposalSubject(title?: string | null) {
  const cleaned = String(title || "").trim();
  if (!cleaned) return "SUPPLY, DELIVERY, INSTALLATION, TESTING & COMMISSIONING PROPOSAL";
  const upper = cleaned.toUpperCase();
  if (upper.includes("SUPPLY") || upper.includes("QUOTATION") || upper.includes("PROPOSAL")) {
    return upper;
  }
  return `SUPPLY, DELIVERY, INSTALLATION, TESTING & COMMISSIONING OF ${upper}`;
}

function buildDefaultCommercialNotes(input: QuotePdfInput) {
  const notes = [
    "Prices are in Kenya Shillings and include the listed scope of supply.",
    "Lead time, site readiness, and delivery schedule are confirmed at order approval.",
    "Any civil works, extra cabling, or accessories outside this quotation are billed separately if required.",
  ];

  if (input.paymentTerms === "DEPOSIT_AND_BALANCE") {
    notes.unshift(
      `Payment terms: ${getQuotePaymentTermsLabel(input.paymentTerms)}${
        typeof input.depositAmount === "number" ? ` (${formatQuoteCurrency(input.depositAmount)} deposit` : ""
      }${
        typeof input.balanceAmount === "number"
          ? `${typeof input.depositAmount === "number" ? ", " : " ("}${formatQuoteCurrency(input.balanceAmount)} balance`
          : typeof input.depositAmount === "number"
            ? ""
            : ""
      }${
        typeof input.depositAmount === "number" || typeof input.balanceAmount === "number" ? ")" : ""
      }.`,
    );
  } else {
    notes.unshift(`Payment terms: ${getQuotePaymentTermsLabel(input.paymentTerms)}.`);
  }

  return notes;
}

function extractLargestPowerToken(value: string) {
  const matches = [...value.matchAll(/\b(\d+(?:\.\d+)?)\s*(kva|kw|w)\b/gi)];
  if (!matches.length) return null;
  const ranked = matches
    .map((match) => {
      const amount = Number(match[1]);
      const unit = match[2].toUpperCase();
      const normalized =
        unit === "W"
          ? amount
          : unit === "KW"
            ? amount * 1000
            : amount * 1000;
      return { label: `${match[1]} ${unit}`, normalized };
    })
    .sort((left, right) => right.normalized - left.normalized);
  return ranked[0]?.label ?? null;
}

function pickItemByPattern(items: StoredQuoteLineItem[], pattern: RegExp) {
  return items.find((item) => pattern.test(item.itemName));
}

function buildSolutionCards(input: QuotePdfInput) {
  const cards: Array<{ label: string; value: string }> = [];
  const sourceText = [input.quoteTitle, ...input.items.map((item) => item.itemName)].join(" ");
  const systemSize = extractLargestPowerToken(sourceText);
  const panel = pickItemByPattern(input.items, /panel|solar panel/i);
  const battery = pickItemByPattern(input.items, /battery|lithium|lifepo4|ah|kwh/i);
  const inverter = pickItemByPattern(input.items, /inverter|hybrid/i);

  if (systemSize) cards.push({ label: "System size", value: systemSize });
  if (panel) cards.push({ label: "Solar", value: panel.itemName });
  if (battery) cards.push({ label: "Battery", value: battery.itemName });
  if (inverter) cards.push({ label: "Inverter", value: inverter.itemName });
  cards.push({ label: "Items", value: String(input.items.length) });
  cards.push({ label: "Total", value: formatQuoteCurrency(input.total) });
  cards.push({ label: "Payment", value: getQuotePaymentTermsLabel(input.paymentTerms || null) });
  cards.push({
    label: "Warranty",
    value:
      input.warrantyMode === "FULL_SYSTEM"
        ? "Full system"
        : input.warrantyMode === "CUSTOM"
          ? "Custom"
          : "Per item",
  });

  return cards.slice(0, 8);
}

async function loadImageAsDataUrl(relativePath: string) {
  try {
    const assetPath = path.join(process.cwd(), relativePath);
    const buffer = await fs.readFile(assetPath);
    const ext = path.extname(relativePath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".svg" ? "image/svg+xml" : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function buildWarrantyRows(input: QuotePdfInput) {
  const fallbackWarranty =
    input.warrantyMode === "FULL_SYSTEM"
      ? input.fullSystemWarranty || "Covered under full system warranty"
      : input.warrantyMode === "CUSTOM"
        ? input.customWarranty || "Custom warranty"
        : "Manufacturer warranty";

  return input.items
    .map((item) => ({
      component: item.itemName,
      warranty: item.warranty || item.defaultWarranty || fallbackWarranty,
      notes: item.warrantyNotes || "Standard coverage",
    }))
    .filter((row) => row.component && row.warranty);
}

function compactLineItems(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function normalizeQuotePdfData(input: QuotePdfInput): QuotePdfRenderData {
  const subject = formatProposalSubject(input.quoteTitle);
  const proposalSummaryLines = sanitizeMessageParagraphs(input.quoteMessage);
  const summaryText =
    proposalSummaryLines[0] ||
    "Thank you for the opportunity to submit our quotation. Below is our proposed supply, pricing, warranty, delivery, and support summary for your review.";
  const companyDetails = splitParagraphLines(input.proposalSections?.companyLegalDetails) || [];
  const preparedBy = splitParagraphLines(input.proposalSections?.preparedByDetails) || [];
  const projectOverview = input.proposalVisibility?.projectOverview === false
    ? null
    : input.proposalSections?.projectOverview || summaryText;
  const priceIncludes =
    input.proposalVisibility?.whatPriceIncludes === false
      ? []
      : compactLineItems(splitParagraphLines(input.proposalSections?.whatPriceIncludes));
  const whatItCanPower =
    input.proposalVisibility?.whatItCanPower === false
      ? []
      : compactLineItems(splitParagraphLines(input.proposalSections?.whatItCanPower));
  const deliveryLines =
    input.proposalVisibility?.deliveryAndInstallation === false
      ? []
      : compactLineItems(
          [
            ...splitParagraphLines(input.proposalSections?.deliveryTimeline).map((line) => `Delivery: ${line}`),
            ...splitParagraphLines(input.proposalSections?.installationTimeline).map((line) => `Installation: ${line}`),
          ],
        );
  const afterSalesSupport =
    input.proposalVisibility?.afterSalesSupport === false
      ? []
      : compactLineItems(splitParagraphLines(input.proposalSections?.afterSalesSupport));
  const importantNotes =
    input.proposalVisibility?.importantNotes === false
      ? []
      : compactLineItems([
          ...buildDefaultCommercialNotes(input),
          ...splitParagraphLines(input.proposalSections?.importantNotes),
        ]);
  const scopeExclusions =
    input.proposalVisibility?.scopeExclusions === false
      ? []
      : compactLineItems(splitParagraphLines(input.proposalSections?.scopeExclusions));
  const termsAndConditions =
    input.proposalVisibility?.termsAndConditions === false
      ? []
      : compactLineItems(splitParagraphLines(input.proposalSections?.termsAndConditions));
  const additionalNotes = compactLineItems(proposalSummaryLines.slice(1));
  const similarProjects =
    input.proposalVisibility?.similarProjects === false
      ? []
      : compactLineItems(splitParagraphLines(input.proposalSections?.similarProjects));
  const referenceLinks = compactLineItems(splitParagraphLines(input.proposalSections?.projectReferenceLinks));
  const paymentSections = input.paymentMethod
    ? [PAYMENT_METHOD_DETAILS[input.paymentMethod]]
    : Object.values(PAYMENT_METHOD_DETAILS);
  const warrantyRows =
    input.proposalVisibility?.warranty === false ? [] : buildWarrantyRows(input);
  const warrantyNotes = compactLineItems([
    ...splitParagraphLines(input.warrantyGeneralNotes),
    ...splitParagraphLines(input.aiWarrantySummary),
  ]);
  const quoteDate = input.issuedAtLabel;
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return {
    subject,
    summaryText,
    quoteDate,
    validUntil,
    companyDetails: companyDetails.length ? companyDetails : splitParagraphLines(QUOTATION_COMPANY_DETAILS),
    preparedBy,
    projectOverview,
    priceIncludes,
    whatItCanPower,
    deliveryLines,
    afterSalesSupport,
    importantNotes,
    scopeExclusions,
    termsAndConditions,
    additionalNotes,
    referenceLinks,
    similarProjects,
    paymentSections,
    warrantyRows,
    warrantyNotes,
    items: input.items,
    solutionCards: buildSolutionCards(input),
  };
}

function renderListSection(title: string, items: string[], tone: "default" | "soft" = "default") {
  if (!items.length) return "";
  return `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      <div class="list ${tone === "soft" ? "list-soft" : ""}">
        ${items.map((item) => `<div class="list-row"><span class="tick">✓</span><span>${escapeHtml(item)}</span></div>`).join("")}
      </div>
    </section>
  `;
}

function renderParagraphSection(title: string, text: string | null | undefined) {
  const value = String(text || "").trim();
  if (!value) return "";
  return `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      <p class="body-copy">${escapeHtml(value)}</p>
    </section>
  `;
}

function renderTextTable(rows: Array<{ left: string; right: string }>) {
  return rows
    .filter((row) => row.right.trim())
    .map(
      (row) => `
        <div class="info-row">
          <div class="info-label">${escapeHtml(row.left)}</div>
          <div class="info-value">${escapeHtml(row.right)}</div>
        </div>
      `,
    )
    .join("");
}

function buildQuotationHtml(input: QuotePdfInput, assets: { letterheadUrl: string | null; logoUrl: string | null }) {
  const data = normalizeQuotePdfData(input);
  const referenceItems = [...data.referenceLinks, ...data.similarProjects];
  const totalsRows = [
    { label: "Subtotal", value: formatQuoteCurrency(input.subtotal), tone: "" },
    ...(input.paymentTerms === "DEPOSIT_AND_BALANCE" && typeof input.depositAmount === "number"
      ? [{ label: "Deposit", value: formatQuoteCurrency(input.depositAmount), tone: "" }]
      : []),
    ...(input.paymentTerms === "DEPOSIT_AND_BALANCE" && typeof input.balanceAmount === "number"
      ? [{ label: "Balance", value: formatQuoteCurrency(input.balanceAmount), tone: "" }]
      : []),
    { label: "Grand Total", value: formatQuoteCurrency(input.total), tone: "grand" },
  ];

  const customerRows = renderTextTable([
    { left: "Customer", right: input.customerName },
    { left: "Phone", right: input.customerPhone || "-" },
    { left: "Email", right: input.customerEmail || "-" },
    { left: "Location", right: input.customerLocation || "-" },
    { left: "Quote Ref", right: input.quoteRef },
    { left: "Quote Date", right: data.quoteDate },
    { left: "Valid Until", right: data.validUntil },
  ]);

  const companyRows = renderTextTable(
    data.companyDetails.map((line, index) => ({
      left: index === 0 ? "Company" : index === 1 ? "Registration" : index === 2 ? "KRA PIN" : "Detail",
      right: line,
    })),
  );

  const preparedByRows = renderTextTable(
    data.preparedBy.map((line, index) => ({
      left: index === 0 ? "Prepared By" : "Detail",
      right: line,
    })),
  );

  const hasOperationsPage =
    data.whatItCanPower.length > 0 ||
    data.deliveryLines.length > 0 ||
    data.afterSalesSupport.length > 0 ||
    data.warrantyRows.length > 0 ||
    data.warrantyNotes.length > 0 ||
    data.importantNotes.length > 0 ||
    data.scopeExclusions.length > 0 ||
    data.additionalNotes.length > 0 ||
    data.termsAndConditions.length > 0;

  const hasCommercialPage = data.paymentSections.length > 0 || referenceItems.length > 0 || Boolean(preparedByRows);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(input.quoteRef)}</title>
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #1f2937;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.35;
            font-size: 11px;
          }
          .document {
            width: 100%;
          }
          .page {
            page-break-after: always;
          }
          .page:last-child {
            page-break-after: auto;
          }
          .cover {
            border: 1px solid #d9cfc1;
            min-height: 274mm;
            display: grid;
            grid-template-columns: 1.03fr 0.97fr;
            overflow: hidden;
          }
          .cover-main {
            padding: 11mm 10mm 12mm 11mm;
          }
          .cover-side {
            position: relative;
            background: linear-gradient(180deg, rgba(125,17,17,0.06), rgba(217,154,32,0.12));
            padding: 12mm 10mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 10mm;
          }
          .cover-side::after {
            content: "";
            position: absolute;
            inset: auto 0 0 auto;
            width: 78%;
            height: 54%;
            background: linear-gradient(140deg, rgba(125,17,17,0.12), rgba(217,154,32,0.22));
            clip-path: polygon(18% 0, 100% 0, 100% 100%, 0 100%);
          }
          .brand-mark {
            width: 100%;
            max-height: 48px;
            object-fit: contain;
            object-position: left center;
            margin-bottom: 6mm;
          }
          .cover-eyebrow {
            color: #7d1111;
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .cover-title {
            margin: 4mm 0 2mm;
            font-size: 18px;
            line-height: 1.08;
            font-weight: 800;
            color: #7d1111;
            text-transform: uppercase;
          }
          .cover-subject {
            margin: 0 0 5mm;
            font-size: 15px;
            font-weight: 800;
            color: #1f2937;
          }
          .lead-copy {
            font-size: 11.5px;
            color: #374151;
            margin: 0 0 4mm;
          }
          .info-stack {
            border: 1px solid #ead9c8;
            background: #fffdf9;
            border-radius: 8px;
            padding: 4mm 4.5mm;
          }
          .info-row {
            display: grid;
            grid-template-columns: 90px 1fr;
            gap: 10px;
            padding: 4px 0;
            border-bottom: 1px solid #f0e5d7;
          }
          .info-row:last-child {
            border-bottom: 0;
          }
          .info-label {
            color: #7d1111;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.06em;
          }
          .info-value {
            color: #111827;
            font-size: 10.5px;
            white-space: pre-wrap;
          }
          .solution-card-grid {
            position: relative;
            z-index: 1;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .cover-side-top {
            position: relative;
            z-index: 1;
            display: grid;
            gap: 8px;
          }
          .summary-box {
            border: 1px solid #e4c9aa;
            background: rgba(255,255,255,0.94);
            border-radius: 10px;
            padding: 10px 11px;
          }
          .summary-box .heading {
            color: #7d1111;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 5px;
          }
          .summary-box .text {
            color: #1f2937;
            font-size: 10.5px;
            line-height: 1.45;
          }
          .cover-side-bottom {
            position: relative;
            z-index: 1;
            border: 1px solid #e4c9aa;
            background: rgba(255,255,255,0.92);
            border-radius: 10px;
            padding: 10px 11px;
          }
          .cover-side-bottom .label {
            color: #7d1111;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 4px;
          }
          .cover-side-bottom .value {
            color: #111827;
            font-size: 10.5px;
            line-height: 1.45;
          }
          .metric-card {
            border: 1px solid #e4c9aa;
            background: rgba(255,255,255,0.94);
            border-radius: 8px;
            padding: 9px 10px;
            min-height: 58px;
          }
          .metric-card .label {
            color: #9b1818;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .metric-card .value {
            margin-top: 4px;
            font-size: 11px;
            font-weight: 700;
            color: #111827;
            word-break: break-word;
          }
          .logo-watermark {
            position: absolute;
            right: 12mm;
            top: 14mm;
            width: 66%;
            opacity: 0.14;
            object-fit: contain;
          }
          .content {
            border: 1px solid #d9cfc1;
            padding: 8mm;
          }
          .top-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
            gap: 10px;
            align-items: start;
          }
          .section {
            margin-bottom: 10px;
            break-inside: avoid;
          }
          h2 {
            margin: 0 0 6px;
            color: #7d1111;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            border-bottom: 1px solid #ead9c8;
            padding-bottom: 5px;
          }
          .body-copy {
            margin: 0;
            font-size: 11px;
            color: #1f2937;
            white-space: pre-wrap;
          }
          .boq {
            margin-top: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          th {
            background: #7d1111;
            color: #ffffff;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            text-align: left;
            padding: 7px 6px;
          }
          td {
            border: 1px solid #ead9c8;
            padding: 6px;
            vertical-align: top;
            font-size: 10px;
          }
          .cell-right {
            text-align: right;
          }
          .totals-box {
            margin-top: 8px;
            margin-left: auto;
            width: 215px;
            border: 1px solid #ead9c8;
            border-radius: 8px;
            overflow: hidden;
            background: #fffdf9;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            padding: 7px 10px;
            border-bottom: 1px solid #f0e5d7;
            font-size: 10px;
          }
          .totals-row:last-child {
            border-bottom: 0;
          }
          .totals-row.grand {
            background: #7d1111;
            color: #fff;
            font-size: 11px;
            font-weight: 800;
          }
          .list {
            display: grid;
            gap: 5px;
          }
          .list-soft {
            padding: 8px;
            border: 1px solid #ead9c8;
            background: #fffaf4;
            border-radius: 8px;
          }
          .list-row {
            display: grid;
            grid-template-columns: 14px 1fr;
            gap: 8px;
            align-items: start;
          }
          .tick {
            color: #15803d;
            font-weight: 800;
            font-size: 11px;
            line-height: 1.2;
          }
          .grid-two {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            align-items: start;
          }
          .payment-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .mini-card {
            border: 1px solid #ead9c8;
            background: #fffdf9;
            border-radius: 8px;
            padding: 8px;
          }
          .mini-card h3 {
            margin: 0 0 6px;
            color: #7d1111;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .mini-card p {
            margin: 0;
            font-size: 10px;
            white-space: pre-wrap;
          }
          .links-box {
            display: grid;
            gap: 6px;
          }
          .link-pill {
            border: 1px solid #ead9c8;
            border-radius: 999px;
            padding: 6px 10px;
            color: #7d1111;
            background: #fff8ef;
            font-size: 10px;
            font-weight: 700;
            word-break: break-all;
          }
          .page-footer {
            margin-top: 12px;
            border-top: 1px solid #ead9c8;
            padding-top: 7px;
            display: flex;
            justify-content: space-between;
            gap: 10px;
            color: #6b7280;
            font-size: 9px;
          }
        </style>
      </head>
      <body>
        <div class="document">
          <div class="page cover">
            <div class="cover-main">
              ${
                assets.letterheadUrl
                  ? `<img class="brand-mark" src="${assets.letterheadUrl}" alt="Betech letterhead" />`
                  : `<div class="cover-eyebrow">Betech Solar Solution Limited</div>`
              }
              <div class="cover-eyebrow">Professional Customer Quotation</div>
              <div class="cover-title">${escapeHtml(input.customerName)}</div>
              <div class="cover-subject">${escapeHtml(data.subject)}</div>
              <p class="lead-copy">${escapeHtml(data.summaryText)}</p>
              <div class="info-stack">
                ${customerRows}
                ${preparedByRows}
              </div>
            </div>
            <div class="cover-side">
              ${assets.logoUrl ? `<img class="logo-watermark" src="${assets.logoUrl}" alt="Betech logo" />` : ""}
              <div class="cover-side-top">
                <div class="summary-box">
                  <div class="heading">Executive Summary</div>
                  <div class="text">${escapeHtml(data.summaryText)}</div>
                </div>
                <div class="solution-card-grid">
                  ${data.solutionCards
                    .map(
                      (card) => `
                        <div class="metric-card">
                          <div class="label">${escapeHtml(card.label)}</div>
                          <div class="value">${escapeHtml(card.value)}</div>
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              </div>
              <div class="cover-side-bottom">
                <div class="label">Prepared Solution</div>
                <div class="value">
                  Clean professional quotation format with scope, pricing, warranty,
                  payment details, and delivery notes prepared for fast customer review.
                </div>
              </div>
            </div>
          </div>

          <div class="page content">
            <div class="top-grid">
              <div>
                ${renderParagraphSection("Executive Summary", data.projectOverview)}
                ${renderListSection("Scope Of Supply", data.priceIncludes, "soft")}
              </div>
              <div>
                <section class="section">
                  <h2>Company Information</h2>
                  <div class="info-stack">
                    ${companyRows}
                  </div>
                </section>
              </div>
            </div>

            <section class="section boq">
              <h2>Detailed Bill Of Quantities</h2>
              <table>
                <thead>
                  <tr>
                    <th style="width:32px;">#</th>
                    <th>Description</th>
                    <th style="width:48px;">Qty</th>
                    <th style="width:88px;">Unit Price</th>
                    <th style="width:88px;">Amount</th>
                    <th style="width:78px;">Warranty</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.items
                    .map(
                      (item, index) => `
                        <tr>
                          <td>${index + 1}</td>
                          <td>${escapeHtml(item.itemName)}</td>
                          <td>${escapeHtml(String(item.quantity))}</td>
                          <td class="cell-right">${escapeHtml(formatQuoteCurrency(item.unitPrice))}</td>
                          <td class="cell-right">${escapeHtml(formatQuoteCurrency(item.lineTotal))}</td>
                          <td>${escapeHtml(item.warranty || item.defaultWarranty || "-")}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
              <div class="totals-box">
                ${totalsRows
                  .map(
                    (row) => `
                      <div class="totals-row ${row.tone}">
                        <span>${escapeHtml(row.label)}</span>
                        <span>${escapeHtml(row.value)}</span>
                      </div>
                    `,
                  )
                  .join("")}
              </div>
            </section>

            <div class="page-footer">
              <span>${escapeHtml(input.quoteRef)}</span>
              <span>Betech Solar Solutions</span>
            </div>
          </div>

          ${
            hasOperationsPage
              ? `
                <div class="page content">
                  <div class="grid-two">
                    <div>
                      ${renderListSection("What This System Can Power", data.whatItCanPower)}
                      ${renderListSection("Delivery & Installation", data.deliveryLines)}
                      ${renderListSection("After-Sales Support", data.afterSalesSupport)}
                    </div>
                    <div>
                      ${
                        data.warrantyRows.length
                          ? `
                            <section class="section">
                              <h2>Warranty Coverage</h2>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Component</th>
                                    <th style="width:120px;">Warranty</th>
                                    <th style="width:120px;">Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${data.warrantyRows
                                    .map(
                                      (row) => `
                                        <tr>
                                          <td>${escapeHtml(row.component)}</td>
                                          <td>${escapeHtml(row.warranty)}</td>
                                          <td>${escapeHtml(row.notes)}</td>
                                        </tr>
                                      `,
                                    )
                                    .join("")}
                                </tbody>
                              </table>
                            </section>
                          `
                          : ""
                      }
                      ${renderListSection("Warranty Notes", data.warrantyNotes, "soft")}
                    </div>
                  </div>

                  <div class="grid-two">
                    <div>
                      ${renderListSection("Important Notes", data.importantNotes, "soft")}
                      ${renderListSection("Scope Exclusions", data.scopeExclusions)}
                    </div>
                    <div>
                      ${renderListSection("Additional Notes", data.additionalNotes)}
                      ${renderListSection("Terms & Conditions", data.termsAndConditions)}
                    </div>
                  </div>

                  <div class="page-footer">
                    <span>${escapeHtml(input.quoteRef)}</span>
                    <span>Compact quotation format</span>
                  </div>
                </div>
              `
              : ""
          }

          ${
            hasCommercialPage
              ? `
                <div class="page content">
                  <div class="payment-grid">
                    <section class="section">
                      <h2>Payment Terms</h2>
                      <div class="mini-card">
                        <h3>Commercial Terms</h3>
                        <p>${escapeHtml(getQuotePaymentTermsLabel(input.paymentTerms || null))}</p>
                      </div>
                      <div style="height:8px;"></div>
                      ${data.paymentSections
                        .map(
                          (section) => `
                            <div class="mini-card" style="margin-bottom:8px;">
                              <h3>${escapeHtml(section.label)}</h3>
                              <p>${escapeHtml(section.lines.join("\n"))}</p>
                            </div>
                          `,
                        )
                        .join("")}
                    </section>

                    ${
                      referenceItems.length
                        ? `
                          <section class="section">
                            <h2>Reference Links & Similar Projects</h2>
                            <div class="links-box">
                              ${referenceItems
                                .map((link) => `<div class="link-pill">${escapeHtml(link)}</div>`)
                                .join("")}
                            </div>
                          </section>
                        `
                        : ""
                    }
                  </div>

                  <section class="section">
                    <h2>Prepared By</h2>
                    <div class="info-stack">
                      ${preparedByRows || `<div class="info-row"><div class="info-label">Team</div><div class="info-value">Betech Solar Solutions Quotations Team</div></div>`}
                    </div>
                  </section>

                  <div class="page-footer">
                    <span>${escapeHtml(input.quoteRef)}</span>
                    <span>Thank you for considering Betech Solar Solutions</span>
                  </div>
                </div>
              `
              : ""
          }
        </div>
      </body>
    </html>
  `;

  return html;
}

export async function buildQuoteProposalPdfBuffer(input: QuotePdfInput) {
  const [letterheadUrl, logoUrl] = await Promise.all([
    loadImageAsDataUrl(path.join("public", "letterhead.jpg")),
    loadImageAsDataUrl(path.join("public", "agents", "betech-logo-crop.png")),
  ]);

  const browser = await launchChromiumBrowser();
  try {
    const page = await browser.newPage();
    const html = buildQuotationHtml(input, { letterheadUrl, logoUrl });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
