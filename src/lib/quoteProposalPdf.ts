import "server-only";

import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
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

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 34;
const TOP_MARGIN = 30;
const FOOTER_HEIGHT = 48;
const BODY_MIN_Y = 82;

const COLORS = {
  text: rgb(0.11, 0.15, 0.2),
  muted: rgb(0.39, 0.44, 0.51),
  accent: rgb(0.47, 0.1, 0.07),
  accentSoft: rgb(0.95, 0.9, 0.86),
  panel: rgb(0.985, 0.98, 0.965),
  border: rgb(0.87, 0.81, 0.75),
  tableHead: rgb(0.48, 0.09, 0.06),
  white: rgb(1, 1, 1),
  success: rgb(0.08, 0.45, 0.24),
};

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    let partial = "";
    for (const char of word) {
      const nextPartial = `${partial}${char}`;
      if (font.widthOfTextAtSize(nextPartial, size) > maxWidth && partial) {
        lines.push(partial);
        partial = char;
      } else {
        partial = nextPartial;
      }
    }
    current = partial;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawTextLines(args: {
  page: PDFPage;
  lines: string[];
  x: number;
  y: number;
  size: number;
  lineGap: number;
  font: PDFFont;
  color: ReturnType<typeof rgb>;
}) {
  let cursorY = args.y;
  for (const line of args.lines) {
    args.page.drawText(line, {
      x: args.x,
      y: cursorY,
      size: args.size,
      font: args.font,
      color: args.color,
    });
    cursorY -= args.lineGap;
  }
  return cursorY;
}

function drawSectionTitle(page: PDFPage, title: string, y: number, fontBold: PDFFont) {
  page.drawText(title.toUpperCase(), {
    x: MARGIN_X,
    y,
    size: 10,
    font: fontBold,
    color: COLORS.accent,
  });
  page.drawLine({
    start: { x: MARGIN_X, y: y - 6 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: y - 6 },
    thickness: 1,
    color: COLORS.border,
  });
  return y - 18;
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

function sanitizeMessageParagraphs(message?: string | null) {
  return String(message || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitParagraphLines(value?: string | null) {
  return String(value || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function drawBulletSection(args: {
  page: PDFPage;
  title: string;
  lines: string[];
  cursorY: number;
  font: PDFFont;
  fontBold: PDFFont;
  ensureSpace: (height: number) => void;
}) {
  if (!args.lines.length) return args.cursorY;
  let cursorY = drawSectionTitle(args.page, args.title, args.cursorY, args.fontBold);
  for (const note of args.lines) {
    const bulletLines = wrapText(note, PAGE_WIDTH - MARGIN_X * 2 - 18, args.font, 9.5);
    args.ensureSpace(bulletLines.length * 13 + 8);
    args.page.drawText("•", {
      x: MARGIN_X + 2,
      y: cursorY,
      size: 12,
      font: args.fontBold,
      color: COLORS.accent,
    });
    cursorY = drawTextLines({
      page: args.page,
      lines: bulletLines,
      x: MARGIN_X + 14,
      y: cursorY,
      size: 9.5,
      lineGap: 13,
      font: args.font,
      color: COLORS.text,
    });
    cursorY -= 4;
  }
  return cursorY;
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
        typeof input.depositAmount === "number"
          ? ` (${formatQuoteCurrency(input.depositAmount)} deposit`
          : ""
      }${
        typeof input.balanceAmount === "number"
          ? `${typeof input.depositAmount === "number" ? ", " : " ("}${formatQuoteCurrency(input.balanceAmount)} balance`
          : typeof input.depositAmount === "number"
            ? ""
            : ""
      }${
        typeof input.depositAmount === "number" || typeof input.balanceAmount === "number"
          ? ")"
          : ""
      }.`,
    );
  } else {
    notes.unshift(`Payment terms: ${getQuotePaymentTermsLabel(input.paymentTerms)}.`);
  }

  return notes;
}

async function loadLetterhead(pdf: PDFDocument) {
  try {
    const letterheadPath = path.join(process.cwd(), "public", "letterhead.jpg");
    const buffer = await fs.readFile(letterheadPath);
    return await pdf.embedJpg(buffer);
  } catch {
    return null;
  }
}

function drawPageHeader(args: {
  page: PDFPage;
  letterheadImage: PDFImage | null;
  pageNumber: number;
  font: PDFFont;
  fontBold: PDFFont;
}) {
  let cursorY = PAGE_HEIGHT - TOP_MARGIN;
  if (args.letterheadImage) {
    const scaled = args.letterheadImage.scaleToFit(PAGE_WIDTH - MARGIN_X * 2, 112);
    args.page.drawImage(args.letterheadImage, {
      x: (PAGE_WIDTH - scaled.width) / 2,
      y: cursorY - scaled.height,
      width: scaled.width,
      height: scaled.height,
    });
    cursorY -= scaled.height + 12;
  } else {
    args.page.drawText("BETECH SOLAR SOLUTIONS", {
      x: MARGIN_X,
      y: cursorY - 6,
      size: 22,
      font: args.fontBold,
      color: COLORS.accent,
    });
    cursorY -= 34;
  }

  args.page.drawLine({
    start: { x: MARGIN_X, y: cursorY },
    end: { x: PAGE_WIDTH - MARGIN_X, y: cursorY },
    thickness: 1,
    color: COLORS.border,
  });
  return cursorY - 14;
}

function drawPageFooter(args: { page: PDFPage; pageNumber: number; font: PDFFont; fontBold: PDFFont }) {
  const footerY = 32;
  args.page.drawLine({
    start: { x: MARGIN_X, y: footerY + 20 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: footerY + 20 },
    thickness: 1,
    color: COLORS.border,
  });
  args.page.drawText("Betech Solar Solutions", {
    x: MARGIN_X,
    y: footerY + 6,
    size: 9,
    font: args.fontBold,
    color: COLORS.accent,
  });
  args.page.drawText("Pramukh Plaza, 3rd Floor, Shop No. 3 • Tel: 0722 151 083 • www.betech.co.ke", {
    x: MARGIN_X,
    y: footerY - 8,
    size: 8.5,
    font: args.font,
    color: COLORS.muted,
  });
  args.page.drawText(`Page ${args.pageNumber}`, {
    x: PAGE_WIDTH - MARGIN_X - 34,
    y: footerY + 6,
    size: 9,
    font: args.font,
    color: COLORS.muted,
  });
}

export async function buildQuoteProposalPdfBuffer(input: QuotePdfInput) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const letterheadImage = await loadLetterhead(pdf);

  const pages: PDFPage[] = [];
  const addPage = () => {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    const bodyStartY = drawPageHeader({
      page,
      letterheadImage,
      pageNumber: pages.length,
      font,
      fontBold,
    });
    drawPageFooter({ page, pageNumber: pages.length, font, fontBold });
    return { page, bodyStartY };
  };

  let { page, bodyStartY } = addPage();
  let cursorY = bodyStartY;

  const ensureSpace = (height: number) => {
    if (cursorY - height >= BODY_MIN_Y) return;
    const next = addPage();
    page = next.page;
    cursorY = next.bodyStartY;
  };

  const subject = formatProposalSubject(input.quoteTitle);
  const proposalSummaryLines = sanitizeMessageParagraphs(input.quoteMessage);
  const summaryText =
    proposalSummaryLines[0] ||
    "Thank you for the opportunity to submit our quotation. Please find below our proposed scope of supply, commercial summary, and payment details for your review.";
  const commercialNotes = buildDefaultCommercialNotes(input);
  const sectionText = {
    projectOverview: input.proposalSections?.projectOverview || summaryText,
    whatPriceIncludes: input.proposalSections?.whatPriceIncludes || null,
    whatItCanPower: input.proposalSections?.whatItCanPower || null,
    deliveryTimeline: input.proposalSections?.deliveryTimeline || null,
    installationTimeline: input.proposalSections?.installationTimeline || null,
    afterSalesSupport: input.proposalSections?.afterSalesSupport || null,
    importantNotes: input.proposalSections?.importantNotes || null,
    scopeExclusions: input.proposalSections?.scopeExclusions || null,
    similarProjects: input.proposalSections?.similarProjects || null,
    termsAndConditions: input.proposalSections?.termsAndConditions || null,
    preparedByDetails: input.proposalSections?.preparedByDetails || null,
    companyLegalDetails: input.proposalSections?.companyLegalDetails || null,
    projectReferenceLinks: input.proposalSections?.projectReferenceLinks || null,
  };
  const sectionVisibility = {
    projectOverview: input.proposalVisibility?.projectOverview !== false,
    whatPriceIncludes: input.proposalVisibility?.whatPriceIncludes !== false,
    whatItCanPower: input.proposalVisibility?.whatItCanPower !== false,
    deliveryAndInstallation: input.proposalVisibility?.deliveryAndInstallation !== false,
    warranty: input.proposalVisibility?.warranty !== false,
    afterSalesSupport: input.proposalVisibility?.afterSalesSupport !== false,
    scopeExclusions: input.proposalVisibility?.scopeExclusions !== false,
    importantNotes: input.proposalVisibility?.importantNotes !== false,
    similarProjects: input.proposalVisibility?.similarProjects !== false,
    termsAndConditions: input.proposalVisibility?.termsAndConditions !== false,
  };

  ensureSpace(134);
  page.drawText("CUSTOMER QUOTATION", {
    x: MARGIN_X,
    y: cursorY,
    size: 11,
    font: fontBold,
    color: COLORS.accent,
  });
  cursorY -= 18;

  const subjectLines = wrapText(subject, PAGE_WIDTH - MARGIN_X * 2, fontBold, 18);
  cursorY = drawTextLines({
    page,
    lines: subjectLines,
    x: MARGIN_X,
    y: cursorY,
    size: 18,
    lineGap: 22,
    font: fontBold,
    color: COLORS.text,
  });
  cursorY -= 4;

  page.drawText(`Quote Ref: ${input.quoteRef}`, {
    x: MARGIN_X,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: COLORS.accent,
  });
  page.drawText(`Issued: ${input.issuedAtLabel}`, {
    x: PAGE_WIDTH - MARGIN_X - 136,
    y: cursorY,
    size: 10,
    font,
    color: COLORS.muted,
  });
  cursorY -= 20;

  const cardHeight = 122;
  const gap = 12;
  const cardWidth = (PAGE_WIDTH - MARGIN_X * 2 - gap) / 2;
  page.drawRectangle({
    x: MARGIN_X,
    y: cursorY - cardHeight,
    width: cardWidth,
    height: cardHeight,
    borderColor: COLORS.border,
    borderWidth: 1,
    color: COLORS.panel,
  });
  page.drawRectangle({
    x: MARGIN_X + cardWidth + gap,
    y: cursorY - cardHeight,
    width: cardWidth,
    height: cardHeight,
    borderColor: COLORS.border,
    borderWidth: 1,
    color: COLORS.panel,
  });

  page.drawText("Prepared For", {
    x: MARGIN_X + 12,
    y: cursorY - 18,
    size: 10,
    font: fontBold,
    color: COLORS.accent,
  });
  drawTextLines({
    page,
    lines: [
      input.customerName,
      `Phone: ${input.customerPhone || "-"}`,
      `Email: ${input.customerEmail || "-"}`,
      `Location: ${input.customerLocation || "-"}`,
    ],
    x: MARGIN_X + 12,
    y: cursorY - 40,
    size: 10,
    lineGap: 15,
    font,
    color: COLORS.text,
  });

  page.drawText("Commercial Snapshot", {
    x: MARGIN_X + cardWidth + gap + 12,
    y: cursorY - 18,
    size: 10,
    font: fontBold,
    color: COLORS.accent,
  });
  drawTextLines({
    page,
    lines: [
      `Quotation title: ${input.quoteTitle?.trim() || "Solar quotation"}`,
      `Payment method: ${getQuotePaymentMethodLabel(input.paymentMethod || null)}`,
      `Payment terms: ${getQuotePaymentTermsLabel(input.paymentTerms || null)}`,
      `Quotation total: ${formatQuoteCurrency(input.total)}`,
    ],
    x: MARGIN_X + cardWidth + gap + 12,
    y: cursorY - 40,
    size: 10,
    lineGap: 15,
    font,
    color: COLORS.text,
  });
  cursorY -= cardHeight + 22;

  if (sectionVisibility.projectOverview) {
    ensureSpace(74);
    cursorY = drawSectionTitle(page, "Project Overview", cursorY, fontBold);
    const introLines = wrapText(sectionText.projectOverview || summaryText, PAGE_WIDTH - MARGIN_X * 2, font, 10.5);
    cursorY = drawTextLines({
      page,
      lines: introLines,
      x: MARGIN_X,
      y: cursorY,
      size: 10.5,
      lineGap: 15,
      font,
      color: COLORS.text,
    });
    cursorY -= 16;
  }

  if (sectionVisibility.whatPriceIncludes && sectionText.whatPriceIncludes) {
    ensureSpace(80);
    cursorY = drawSectionTitle(page, "What Price Includes", cursorY, fontBold);
    cursorY = drawTextLines({
      page,
      lines: wrapText(sectionText.whatPriceIncludes, PAGE_WIDTH - MARGIN_X * 2, font, 9.8),
      x: MARGIN_X,
      y: cursorY,
      size: 9.8,
      lineGap: 14,
      font,
      color: COLORS.text,
    });
    cursorY -= 14;
  }

  ensureSpace(90);
  cursorY = drawSectionTitle(page, "Bill Of Quantities / Scope Of Supply", cursorY, fontBold);

  const tableWidth = PAGE_WIDTH - MARGIN_X * 2;
  const colNo = 28;
  const colItem = 258;
  const colQty = 52;
  const colUnit = 95;
  const colTotal = tableWidth - colNo - colItem - colQty - colUnit;
  const tableX = MARGIN_X;

  const drawTableHeader = () => {
    page.drawRectangle({
      x: tableX,
      y: cursorY - 22,
      width: tableWidth,
      height: 22,
      color: COLORS.tableHead,
    });
    let x = tableX;
    const headerCells: Array<[string, number]> = [
      ["#", colNo],
      ["Description", colItem],
      ["Qty", colQty],
      ["Unit Price", colUnit],
      ["Amount", colTotal],
    ];
    for (const [label, width] of headerCells) {
      page.drawText(label, {
        x: x + 6,
        y: cursorY - 15,
        size: 9,
        font: fontBold,
        color: COLORS.white,
      });
      x += width;
    }
    cursorY -= 24;
  };

  drawTableHeader();

  input.items.forEach((item, index) => {
    const wrapped = wrapText(item.itemName, colItem - 12, font, 9.5);
    const rowHeight = Math.max(24, wrapped.length * 12 + 8);
    ensureSpace(rowHeight + 12);
    if (cursorY < BODY_MIN_Y + rowHeight + 16) {
      const next = addPage();
      page = next.page;
      cursorY = next.bodyStartY;
      cursorY = drawSectionTitle(page, "Bill Of Quantities / Scope Of Supply", cursorY, fontBold);
      drawTableHeader();
    }

    page.drawRectangle({
      x: tableX,
      y: cursorY - rowHeight,
      width: tableWidth,
      height: rowHeight,
      borderColor: COLORS.border,
      borderWidth: 1,
      color: index % 2 === 0 ? COLORS.white : COLORS.panel,
    });

    let x = tableX;
    page.drawText(String(index + 1), {
      x: x + 8,
      y: cursorY - 15,
      size: 9.5,
      font,
      color: COLORS.text,
    });
    x += colNo;

    drawTextLines({
      page,
      lines: wrapped,
      x: x + 6,
      y: cursorY - 15,
      size: 9.5,
      lineGap: 12,
      font,
      color: COLORS.text,
    });
    x += colItem;

    page.drawText(String(item.quantity), {
      x: x + 6,
      y: cursorY - 15,
      size: 9.5,
      font,
      color: COLORS.text,
    });
    x += colQty;

    page.drawText(formatQuoteCurrency(item.unitPrice), {
      x: x + 6,
      y: cursorY - 15,
      size: 9.5,
      font,
      color: COLORS.text,
    });
    x += colUnit;

    page.drawText(formatQuoteCurrency(item.lineTotal), {
      x: x + 6,
      y: cursorY - 15,
      size: 9.5,
      font: fontBold,
      color: COLORS.text,
    });

    cursorY -= rowHeight;
  });

  cursorY -= 14;
  ensureSpace(120);

  const totalsBoxWidth = 210;
  const totalsX = PAGE_WIDTH - MARGIN_X - totalsBoxWidth;
  const totalsRows: Array<[string, string, boolean]> = [
    ["Subtotal", formatQuoteCurrency(input.subtotal), false],
    ["Grand Total", formatQuoteCurrency(input.total), true],
  ];
  if (input.paymentTerms === "DEPOSIT_AND_BALANCE") {
    if (typeof input.depositAmount === "number") {
      totalsRows.push(["Deposit", formatQuoteCurrency(input.depositAmount), false]);
    }
    if (typeof input.balanceAmount === "number") {
      totalsRows.push(["Balance", formatQuoteCurrency(input.balanceAmount), false]);
    }
  }
  const totalsHeight = 18 + totalsRows.length * 18 + 10;
  page.drawRectangle({
    x: totalsX,
    y: cursorY - totalsHeight,
    width: totalsBoxWidth,
    height: totalsHeight,
    borderColor: COLORS.border,
    borderWidth: 1,
    color: COLORS.panel,
  });
  page.drawText("Commercial Summary", {
    x: totalsX + 12,
    y: cursorY - 16,
    size: 10,
    font: fontBold,
    color: COLORS.accent,
  });
  let totalsY = cursorY - 34;
  for (const [label, value, highlight] of totalsRows) {
    page.drawText(label, {
      x: totalsX + 12,
      y: totalsY,
      size: highlight ? 10.5 : 9.5,
      font: highlight ? fontBold : font,
      color: COLORS.text,
    });
    page.drawText(value, {
      x: totalsX + 114,
      y: totalsY,
      size: highlight ? 10.5 : 9.5,
      font: highlight ? fontBold : font,
      color: highlight ? COLORS.success : COLORS.text,
    });
    totalsY -= 18;
  }
  cursorY -= totalsHeight + 22;

  if (sectionVisibility.whatItCanPower && sectionText.whatItCanPower) {
    ensureSpace(84);
    cursorY = drawSectionTitle(page, "What This Solution Can Support", cursorY, fontBold);
    cursorY = drawTextLines({
      page,
      lines: wrapText(sectionText.whatItCanPower, PAGE_WIDTH - MARGIN_X * 2, font, 9.8),
      x: MARGIN_X,
      y: cursorY,
      size: 9.8,
      lineGap: 14,
      font,
      color: COLORS.text,
    });
    cursorY -= 14;
  }

  if (sectionVisibility.deliveryAndInstallation) {
    const combined = [
      sectionText.deliveryTimeline ? `Delivery: ${sectionText.deliveryTimeline}` : "",
      sectionText.installationTimeline ? `Installation: ${sectionText.installationTimeline}` : "",
    ].filter(Boolean);
    if (combined.length) {
      ensureSpace(80);
      cursorY = drawSectionTitle(page, "Delivery And Installation", cursorY, fontBold);
      cursorY = drawTextLines({
        page,
        lines: combined.flatMap((line) => wrapText(line, PAGE_WIDTH - MARGIN_X * 2, font, 9.8)),
        x: MARGIN_X,
        y: cursorY,
        size: 9.8,
        lineGap: 14,
        font,
        color: COLORS.text,
      });
      cursorY -= 14;
    }
  }

  if (sectionVisibility.warranty) {
    const warrantyRows = input.items
      .map((item) => [
        item.itemName,
        item.warranty ||
          item.defaultWarranty ||
          (input.warrantyMode === "FULL_SYSTEM"
            ? input.fullSystemWarranty || "Covered under full system warranty"
            : input.warrantyMode === "CUSTOM"
              ? input.customWarranty || "Custom warranty"
              : "Manufacturer warranty"),
        item.warrantyNotes || "",
      ] as const)
      .filter((row) => row[0] && row[1]);

    if (warrantyRows.length || input.warrantyGeneralNotes || input.aiWarrantySummary) {
      ensureSpace(120);
      cursorY = drawSectionTitle(page, "Warranty Coverage", cursorY, fontBold);
      const warrantyTableWidth = PAGE_WIDTH - MARGIN_X * 2;
      const compWidth = 205;
      const warrWidth = 170;
      const noteWidth = warrantyTableWidth - compWidth - warrWidth;
      page.drawRectangle({
        x: MARGIN_X,
        y: cursorY - 22,
        width: warrantyTableWidth,
        height: 22,
        color: COLORS.tableHead,
      });
      let warrantyHeaderX = MARGIN_X;
      for (const [label, width] of [
        ["Component", compWidth],
        ["Warranty", warrWidth],
        ["Notes", noteWidth],
      ] as const) {
        page.drawText(label, {
          x: warrantyHeaderX + 6,
          y: cursorY - 15,
          size: 9,
          font: fontBold,
          color: COLORS.white,
        });
        warrantyHeaderX += width;
      }
      cursorY -= 24;
      for (const [component, warranty, notes] of warrantyRows) {
        const componentLines = wrapText(component, compWidth - 10, font, 9);
        const warrantyLines = wrapText(warranty, warrWidth - 10, font, 9);
        const noteLines = wrapText(notes || "-", noteWidth - 10, font, 9);
        const rowHeight = Math.max(componentLines.length, warrantyLines.length, noteLines.length) * 12 + 8;
        ensureSpace(rowHeight + 8);
        page.drawRectangle({
          x: MARGIN_X,
          y: cursorY - rowHeight,
          width: warrantyTableWidth,
          height: rowHeight,
          borderColor: COLORS.border,
          borderWidth: 1,
          color: COLORS.panel,
        });
        drawTextLines({ page, lines: componentLines, x: MARGIN_X + 6, y: cursorY - 14, size: 9, lineGap: 12, font, color: COLORS.text });
        drawTextLines({ page, lines: warrantyLines, x: MARGIN_X + compWidth + 6, y: cursorY - 14, size: 9, lineGap: 12, font, color: COLORS.text });
        drawTextLines({ page, lines: noteLines, x: MARGIN_X + compWidth + warrWidth + 6, y: cursorY - 14, size: 9, lineGap: 12, font, color: COLORS.text });
        cursorY -= rowHeight;
      }
      const warrantyNotes = [
        ...splitParagraphLines(input.warrantyGeneralNotes),
        ...splitParagraphLines(input.aiWarrantySummary),
      ];
      if (warrantyNotes.length) {
        cursorY -= 10;
        cursorY = drawBulletSection({
          page,
          title: "Warranty Notes",
          lines: warrantyNotes,
          cursorY,
          font,
          fontBold,
          ensureSpace,
        });
      }
    }
  }

  ensureSpace(140);
  cursorY = drawSectionTitle(page, "Payment Details", cursorY, fontBold);
  const paymentSections = input.paymentMethod
    ? [PAYMENT_METHOD_DETAILS[input.paymentMethod]]
    : Object.values(PAYMENT_METHOD_DETAILS);

  for (const section of paymentSections) {
    const lines = [section.label, ...section.lines];
    const boxHeight = 20 + lines.length * 13;
    ensureSpace(boxHeight + 10);
    page.drawRectangle({
      x: MARGIN_X,
      y: cursorY - boxHeight,
      width: PAGE_WIDTH - MARGIN_X * 2,
      height: boxHeight,
      borderColor: COLORS.border,
      borderWidth: 1,
      color: COLORS.panel,
    });
    page.drawText(lines[0], {
      x: MARGIN_X + 12,
      y: cursorY - 16,
      size: 10,
      font: fontBold,
      color: COLORS.accent,
    });
    drawTextLines({
      page,
      lines: lines.slice(1),
      x: MARGIN_X + 12,
      y: cursorY - 34,
      size: 9.5,
      lineGap: 13,
      font,
      color: COLORS.text,
    });
    cursorY -= boxHeight + 10;
  }

  if (sectionVisibility.afterSalesSupport && sectionText.afterSalesSupport) {
    cursorY = drawBulletSection({
      page,
      title: "After-sales Support",
      lines: splitParagraphLines(sectionText.afterSalesSupport),
      cursorY,
      font,
      fontBold,
      ensureSpace,
    });
  }

  if (sectionVisibility.importantNotes) {
    cursorY = drawBulletSection({
      page,
      title: "Important Notes",
      lines: [...commercialNotes, ...splitParagraphLines(sectionText.importantNotes)],
      cursorY,
      font,
      fontBold,
      ensureSpace,
    });
  }

  if (sectionVisibility.scopeExclusions && sectionText.scopeExclusions) {
    cursorY = drawBulletSection({
      page,
      title: "Scope Exclusions",
      lines: splitParagraphLines(sectionText.scopeExclusions),
      cursorY,
      font,
      fontBold,
      ensureSpace,
    });
  }

  if (sectionVisibility.similarProjects && sectionText.similarProjects) {
    ensureSpace(72);
    cursorY = drawSectionTitle(page, "Similar Projects", cursorY, fontBold);
    cursorY = drawTextLines({
      page,
      lines: wrapText(sectionText.similarProjects, PAGE_WIDTH - MARGIN_X * 2, font, 9.8),
      x: MARGIN_X,
      y: cursorY,
      size: 9.8,
      lineGap: 14,
      font,
      color: COLORS.text,
    });
    cursorY -= 14;
  }

  if (sectionVisibility.termsAndConditions && sectionText.termsAndConditions) {
    cursorY = drawBulletSection({
      page,
      title: "Terms And Conditions",
      lines: splitParagraphLines(sectionText.termsAndConditions),
      cursorY,
      font,
      fontBold,
      ensureSpace,
    });
  }

  const extraParagraphs = proposalSummaryLines.slice(1);
  if (extraParagraphs.length) {
    cursorY -= 8;
    ensureSpace(60);
    cursorY = drawSectionTitle(page, "Additional Scope / Notes", cursorY, fontBold);
    for (const paragraph of extraParagraphs) {
      const lines = wrapText(paragraph, PAGE_WIDTH - MARGIN_X * 2, font, 9.5);
      ensureSpace(lines.length * 13 + 6);
      cursorY = drawTextLines({
        page,
        lines,
        x: MARGIN_X,
        y: cursorY,
        size: 9.5,
        lineGap: 13,
        font,
        color: COLORS.text,
      });
      cursorY -= 6;
    }
  }

  if (sectionText.projectReferenceLinks) {
    ensureSpace(56);
    cursorY = drawSectionTitle(page, "Reference Links", cursorY, fontBold);
    cursorY = drawTextLines({
      page,
      lines: wrapText(sectionText.projectReferenceLinks, PAGE_WIDTH - MARGIN_X * 2, font, 9.5),
      x: MARGIN_X,
      y: cursorY,
      size: 9.5,
      lineGap: 13,
      font,
      color: COLORS.text,
    });
    cursorY -= 10;
  }

  if (sectionText.companyLegalDetails || sectionText.preparedByDetails) {
    ensureSpace(72);
    cursorY = drawSectionTitle(page, "Prepared By", cursorY, fontBold);
    const footerNotes = [
      ...splitParagraphLines(sectionText.preparedByDetails),
      ...splitParagraphLines(sectionText.companyLegalDetails),
    ];
    cursorY = drawTextLines({
      page,
      lines: footerNotes.flatMap((line) => wrapText(line, PAGE_WIDTH - MARGIN_X * 2, font, 9.2)),
      x: MARGIN_X,
      y: cursorY,
      size: 9.2,
      lineGap: 13,
      font,
      color: COLORS.text,
    });
  }

  return Buffer.from(await pdf.save());
}
