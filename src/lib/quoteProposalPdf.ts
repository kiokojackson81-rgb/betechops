import "server-only";

import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  formatQuoteCurrency,
  getQuotePaymentMethodLabel,
  getQuotePaymentTermsLabel,
  PAYMENT_METHOD_DETAILS,
  type QuotePaymentMethod,
  type QuotePaymentTerms,
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
};

function wrapText(
  text: string,
  maxWidth: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
) {
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

function drawTextBlock(
  page: import("pdf-lib").PDFPage,
  lines: string[],
  x: number,
  y: number,
  size: number,
  lineGap: number,
  color: ReturnType<typeof rgb>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
) {
  let cursorY = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= lineGap;
  }
  return cursorY;
}

export async function buildQuoteProposalPdfBuffer(input: QuotePdfInput) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const marginX = 34;
  let cursorY = height - 32;

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  try {
    const letterheadPath = path.join(process.cwd(), "public", "letterhead.jpg");
    const letterheadBuffer = await fs.readFile(letterheadPath);
    const letterheadImage = await pdf.embedJpg(letterheadBuffer);
    const scaled = letterheadImage.scaleToFit(width - marginX * 2, 118);
    page.drawImage(letterheadImage, {
      x: (width - scaled.width) / 2,
      y: cursorY - scaled.height,
      width: scaled.width,
      height: scaled.height,
    });
    cursorY -= scaled.height + 16;
  } catch {
    page.drawText("BETECH SOLAR SOLUTIONS", {
      x: marginX,
      y: cursorY,
      size: 24,
      font: fontBold,
      color: rgb(0.48, 0, 0),
    });
    cursorY -= 30;
  }

  const accent = rgb(0.48, 0, 0);
  const border = rgb(0.93, 0.87, 0.79);
  const light = rgb(0.99, 0.98, 0.95);
  const text = rgb(0.13, 0.16, 0.21);
  const muted = rgb(0.34, 0.39, 0.47);

  page.drawText(input.quoteTitle?.trim() || "Quotation Proposal", {
    x: marginX,
    y: cursorY,
    size: 18,
    font: fontBold,
    color: text,
  });
  cursorY -= 22;

  page.drawText(`Quote Ref: ${input.quoteRef}`, {
    x: marginX,
    y: cursorY,
    size: 11,
    font: fontBold,
    color: accent,
  });
  cursorY -= 18;

  const cardHeight = 92;
  const cardWidth = (width - marginX * 2 - 12) / 2;
  page.drawRectangle({
    x: marginX,
    y: cursorY - cardHeight,
    width: cardWidth,
    height: cardHeight,
    borderColor: border,
    borderWidth: 1,
    color: light,
  });
  page.drawRectangle({
    x: marginX + cardWidth + 12,
    y: cursorY - cardHeight,
    width: cardWidth,
    height: cardHeight,
    borderColor: border,
    borderWidth: 1,
    color: light,
  });

  const infoY = cursorY - 16;
  drawTextBlock(
    page,
    [
      `Customer: ${input.customerName}`,
      `Phone: ${input.customerPhone || "-"}`,
      `Email: ${input.customerEmail || "-"}`,
      `Location: ${input.customerLocation || "-"}`,
    ],
    marginX + 12,
    infoY,
    10,
    14,
    text,
    font,
  );
  drawTextBlock(
    page,
    [
      `Issued: ${input.issuedAtLabel}`,
      `Payment method: ${getQuotePaymentMethodLabel(input.paymentMethod || null)}`,
      `Payment terms: ${getQuotePaymentTermsLabel(input.paymentTerms || null)}`,
    ],
    marginX + cardWidth + 24,
    infoY,
    10,
    14,
    text,
    font,
  );
  cursorY -= cardHeight + 18;

  page.drawText("ITEMS", {
    x: marginX,
    y: cursorY,
    size: 11,
    font: fontBold,
    color: accent,
  });
  cursorY -= 14;

  for (const item of input.items) {
    const titleLines = wrapText(item.itemName, width - marginX * 2 - 24, fontBold, 11);
    const itemBlockHeight = 14 + titleLines.length * 14 + 38;
    if (cursorY - itemBlockHeight < 150) {
      break;
    }

    page.drawRectangle({
      x: marginX,
      y: cursorY - itemBlockHeight,
      width: width - marginX * 2,
      height: itemBlockHeight,
      borderColor: border,
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });

    page.drawRectangle({
      x: marginX,
      y: cursorY - 28,
      width: width - marginX * 2,
      height: 28,
      color: light,
    });

    page.drawText("Item name", {
      x: marginX + 12,
      y: cursorY - 18,
      size: 10,
      font: fontBold,
      color: accent,
    });

    let itemY = cursorY - 42;
    itemY = drawTextBlock(page, titleLines, marginX + 12, itemY, 11, 14, text, fontBold);

    const summaryY = cursorY - itemBlockHeight + 14;
    page.drawText("Quantity", {
      x: marginX + 12,
      y: summaryY + 12,
      size: 9,
      font: fontBold,
      color: accent,
    });
    page.drawText("Unit price", {
      x: marginX + 200,
      y: summaryY + 12,
      size: 9,
      font: fontBold,
      color: accent,
    });
    page.drawText("Total", {
      x: width - marginX - 88,
      y: summaryY + 12,
      size: 9,
      font: fontBold,
      color: accent,
    });

    page.drawText(String(item.quantity), {
      x: marginX + 12,
      y: summaryY - 2,
      size: 11,
      font,
      color: text,
    });
    page.drawText(formatQuoteCurrency(item.unitPrice), {
      x: marginX + 200,
      y: summaryY - 2,
      size: 11,
      font,
      color: text,
    });
    page.drawText(formatQuoteCurrency(item.lineTotal), {
      x: width - marginX - 88,
      y: summaryY - 2,
      size: 11,
      font: fontBold,
      color: text,
    });

    cursorY -= itemBlockHeight + 12;
  }

  const totalsHeight = 92;
  page.drawRectangle({
    x: marginX,
    y: cursorY - totalsHeight,
    width: width - marginX * 2,
    height: totalsHeight,
    borderColor: border,
    borderWidth: 1,
    color: light,
  });

  const totalsXLabel = marginX + 16;
  const totalsXValue = width - marginX - 120;
  let totalsY = cursorY - 20;
  const rows: Array<[string, string]> = [
    ["Subtotal", formatQuoteCurrency(input.subtotal)],
    ["Total", formatQuoteCurrency(input.total)],
  ];
  if (input.paymentTerms === "DEPOSIT_AND_BALANCE") {
    if (typeof input.depositAmount === "number") {
      rows.push(["Deposit", formatQuoteCurrency(input.depositAmount)]);
    }
    if (typeof input.balanceAmount === "number") {
      rows.push(["Balance", formatQuoteCurrency(input.balanceAmount)]);
    }
  }

  for (const [label, value] of rows) {
    page.drawText(`${label}:`, {
      x: totalsXLabel,
      y: totalsY,
      size: label === "Total" ? 11 : 10,
      font: label === "Total" ? fontBold : font,
      color: text,
    });
    page.drawText(value, {
      x: totalsXValue,
      y: totalsY,
      size: label === "Total" ? 12 : 10,
      font: label === "Total" ? fontBold : font,
      color: text,
    });
    totalsY -= 16;
  }
  cursorY -= totalsHeight + 14;

  const paymentDetails = input.paymentMethod
    ? [PAYMENT_METHOD_DETAILS[input.paymentMethod]]
    : Object.values(PAYMENT_METHOD_DETAILS);
  const paymentLines = paymentDetails.flatMap((section) => [
    section.label,
    ...section.lines,
    "",
  ]);
  const paymentBlockLines = paymentLines.length ? paymentLines.slice(0, -1) : [];

  cursorY = drawTextBlock(
    page,
    ["Payment options", ...paymentBlockLines],
    marginX,
    cursorY,
    10,
    14,
    text,
    font,
  );
  cursorY -= 6;

  if (input.quoteMessage?.trim()) {
    const noteLines = wrapText(input.quoteMessage.trim(), width - marginX * 2, font, 10);
    cursorY = drawTextBlock(page, ["Customer note", ...noteLines], marginX, cursorY, 10, 14, muted, font);
  }

  const footerLines = [
    "Prepared by Betech Solar Solutions.",
    "For assistance call +254 722 151 083 or +254 703 241 917.",
    "Visit www.betech.co.ke to log in, review your quotation, and follow up on the next step.",
  ];
  const footerStartY = 74;
  page.drawLine({
    start: { x: marginX, y: footerStartY + 22 },
    end: { x: width - marginX, y: footerStartY + 22 },
    thickness: 1,
    color: border,
  });
  drawTextBlock(page, footerLines, marginX, footerStartY, 9, 12, muted, font);

  return Buffer.from(await pdf.save());
}
