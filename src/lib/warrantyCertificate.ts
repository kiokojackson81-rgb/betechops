import "server-only";

import { readFile } from "fs/promises";
import path from "path";
import * as QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import { getBranding } from "@/lib/branding";
import { TERMS_DISPLAY_URL, TERMS_URL } from "@/lib/publicLinks";

export type WarrantyEquipment = {
  equipment: "Solar Panels" | "Inverter" | "Lithium Battery";
  brand: string;
  modelCapacity: string;
  serialNumbers: string;
  warrantyYears: number;
  warrantyStartDate: string;
  warrantyExpiryDate: string;
};

export type WarrantyCertificateSnapshot = {
  certificateNo: string;
  coverageStatus?: string;
  links?: { receiptId: string; commissioningSessionId: string; orderId: string | null; customerId: string | null };
  completionCertificateNo: string;
  projectReference: string;
  customerName: string;
  customerPhone: string;
  installationLocation: string;
  installationType: string;
  systemConfiguration: string;
  technicianName: string;
  technicianSignatureUrl?: string | null;
  authorisedByName?: string | null;
  authorisedByTitle?: string | null;
  authorisedByQualification?: string | null;
  authorisedByLicenceNumber?: string | null;
  authorisedSignatureUrl?: string | null;
  companyStampUrl?: string | null;
  commissioningDate: string;
  issueDate: string;
  verificationUrl: string;
  equipment: WarrantyEquipment[];
};

const A4: [number, number] = [595.28, 841.89];
const M = 28;
const MAROON = rgb(0.55, 0.01, 0.03);
const INK = rgb(0.06, 0.12, 0.23);
const MUTED = rgb(0.32, 0.37, 0.46);
const GREEN = rgb(0.02, 0.46, 0.22);
const PALE = rgb(0.985, 0.975, 0.96);
const WARRANTY_SUPPORT_URL = "https://www.betech.co.ke/warranty-support";
const REPORT_ISSUE_URL = "https://www.betech.co.ke/support/report-issue";

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const words = value.split(/\s+/).filter(Boolean).flatMap(word => {
    const chunks: string[] = []; let chunk = "";
    for (const char of word) { if (chunk && font.widthOfTextAtSize(chunk + char, size) > width) { chunks.push(chunk); chunk = char; } else chunk += char; }
    if (chunk) chunks.push(chunk);
    return chunks;
  });
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(next, size) > width) { lines.push(current); current = word; }
    else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrapped(page: PDFPage, value: string, x: number, y: number, width: number, font: PDFFont, size: number, color = INK, line = size + 2) {
  const lines = wrap(value, font, size, width);
  lines.forEach((item, index) => page.drawText(item, { x, y: y - index * line, size, font, color }));
  return Math.max(line, lines.length * line);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", day: "2-digit", month: "long", year: "numeric" });
}

async function letterheadBytes() {
  for (const candidate of [path.join(process.cwd(), "public", "letterhead.jpg"), path.join(process.cwd(), "letterhead.jpg")]) {
    try { return await readFile(candidate); } catch { /* Use the next existing letterhead location. */ }
  }
  return null;
}

async function imageFromUrl(pdf: PDFDocument, url: string) {
  try {
    const inline = url.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
    if (inline) return /png/i.test(inline[1]) ? await pdf.embedPng(Buffer.from(inline[2], "base64")) : await pdf.embedJpg(Buffer.from(inline[2], "base64"));
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return /png/i.test(response.headers.get("content-type") || url) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch { return null; }
}

function drawLetterhead(page: PDFPage, image: PDFImage | null) {
  if (!image) return;
  const scale = Math.min(500 / image.width, 75 / image.height);
  page.drawImage(image, { x: (A4[0] - image.width * scale) / 2, y: 758, width: image.width * scale, height: image.height * scale });
}

function section(page: PDFPage, title: string, y: number, bold: PDFFont) {
  page.drawRectangle({ x: M, y: y - 4, width: A4[0] - M * 2, height: 18, color: MAROON });
  page.drawText(title, { x: M + 9, y: y + 1, size: 9, font: bold, color: rgb(1, 1, 1) });
}

function box(page: PDFPage, x: number, y: number, width: number, height: number) {
  page.drawRectangle({ x, y, width, height, color: PALE, borderColor: rgb(0.8, 0.82, 0.85), borderWidth: 0.45 });
}

function drawStamp(page: PDFPage, image: PDFImage | null, date: string, bold: PDFFont) {
  if (!image) return;
  const max = 56;
  const scale = Math.min(max / image.width, max / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x: 250 + (max - width) / 2, y: 55 + (max - height) / 2, width, height });
  page.drawText("Company Stamp", { x: 249, y: 47, size: 5.5, font: bold, color: MAROON });
  page.drawText(`Date: ${formatDate(date)}`, { x: 244, y: 39, size: 5.3, font: bold, color: MUTED });
}

/** Builds the single, compact issued warranty document from an immutable snapshot. */
export async function buildWarrantyCertificatePdf(snapshot: WarrantyCertificateSnapshot, options: { preview?: boolean } = {}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(A4);
  const branding = await getBranding();
  const letterhead = await letterheadBytes();
  let letterheadImage: PDFImage | null = null;
  if (letterhead) {
    try { letterheadImage = await pdf.embedJpg(letterhead); } catch { try { letterheadImage = await pdf.embedPng(letterhead); } catch { /* Preserve the certificate content if an asset is unavailable. */ } }
  }
  const stamp = !options.preview && (snapshot.companyStampUrl || branding.digitalStampUrl) ? await imageFromUrl(pdf, snapshot.companyStampUrl || branding.digitalStampUrl!) : null;
  const technicianSignature = snapshot.technicianSignatureUrl ? await imageFromUrl(pdf, snapshot.technicianSignatureUrl) : null;
  const authorisedSignature = snapshot.authorisedSignatureUrl ? await imageFromUrl(pdf, snapshot.authorisedSignatureUrl) : null;
  if (!options.preview && !stamp) throw new Error("The existing Betech digital stamp must be configured and accessible before warranty issuance.");
  drawLetterhead(page, letterheadImage);

  page.drawLine({ start: { x: M, y: 749 }, end: { x: A4[0] - M, y: 749 }, thickness: 3, color: MAROON });
  page.drawText("WARRANTY CERTIFICATE", { x: M, y: 712, size: 26, font: bold, color: MAROON });
  page.drawText("RELIABLE SOLAR SOLUTIONS. LONGER PEACE OF MIND.", { x: M, y: 696, size: 9, font: bold, color: MAROON });
  drawWrapped(page, "This certificate confirms the warranty registration of the solar equipment listed below following successful installation, testing and commissioning by Betech Solar Solutions. Warranty coverage is subject to the applicable manufacturer warranty conditions and Betech Solar Terms & Conditions.", M, 682, 340, regular, 8.1, INK, 11);
  box(page, 382, 651, 185, 75);
  [["Warranty Certificate No.", snapshot.certificateNo], ["Completion Certificate No.", snapshot.completionCertificateNo], ["Project Reference", snapshot.projectReference], ["Issue Date", formatDate(snapshot.issueDate)]].forEach(([label, value], index) => {
    const y = 710 - index * 17;
    page.drawText(label, { x: 390, y, size: 6.2, font: bold, color: INK });
    page.drawText(value, { x: 476, y, size: Math.min(6.3, 84 / Math.max(1, bold.widthOfTextAtSize(value, 1))), font: bold, color: INK });
  });

  let y = 628;
  section(page, "1. CUSTOMER & PROJECT DETAILS  (inherited from Completion Certificate)", y, bold);
  box(page, M, y - 108, A4[0] - M * 2, 94);
  const left: Array<[string, string]> = [["Customer Name", snapshot.customerName], ["Phone Number", snapshot.customerPhone || "Not recorded"], ["Installation Location", snapshot.installationLocation], ["Project Reference", snapshot.projectReference], ["Completion Certificate No.", snapshot.completionCertificateNo]];
  const right: Array<[string, string]> = [["Commissioning Date", formatDate(snapshot.commissioningDate)], ["Warranty Start Date", formatDate(snapshot.commissioningDate)], ["Installation Type", snapshot.installationType], ["System Configuration", snapshot.systemConfiguration], ["Assigned Technician", snapshot.technicianName]];
  [left, right].forEach((group, column) => group.forEach(([label, value], index) => {
    const x = M + 10 + column * 268;
    const rowY = y - 28 - index * 16;
    page.drawText(`${label}:`, { x, y: rowY, size: 6.7, font: bold, color: INK });
    page.drawText(value || "Not recorded", { x: x + 102, y: rowY, size: 6.7, font: regular, color: INK, maxWidth: 152 });
  }));

  y = 499;
  section(page, "2. EQUIPMENT WARRANTY DETAILS  (inherited from Completion Certificate)", y, bold);
  const cols = [M, 94, 146, 254, 374, 445, 511, A4[0] - M];
  const headings = ["Equipment", "Brand", "Model / Capacity", "Serial Number(s)", "Warranty", "Start Date", "Expiry Date"];
  page.drawRectangle({ x: M, y: 460, width: A4[0] - M * 2, height: 21, color: rgb(0.96, 0.91, 0.9), borderColor: rgb(0.78, 0.79, 0.82), borderWidth: 0.45 });
  headings.forEach((heading, index) => page.drawText(heading, { x: cols[index] + 4, y: 468, size: 6.1, font: bold, color: INK }));
  snapshot.equipment.slice(0, 3).forEach((row, index) => {
    const top = 460 - index * 58;
    page.drawRectangle({ x: M, y: top - 58, width: A4[0] - M * 2, height: 58, color: index % 2 ? rgb(0.99, 0.99, 0.99) : PALE, borderColor: rgb(0.8, 0.82, 0.85), borderWidth: 0.4 });
    const values = [row.equipment, row.brand, row.modelCapacity, row.equipment === "Solar Panels" && row.serialNumbers !== "Not recorded" ? "Recorded in Commissioning Record" : row.serialNumbers, `${row.warrantyYears} Years`, formatDate(row.warrantyStartDate), formatDate(row.warrantyExpiryDate)];
    values.forEach((value, cell) => drawWrapped(page, value || "Not recorded", cols[cell] + 4, top - 16, cols[cell + 1] - cols[cell] - 8, cell === 4 ? bold : regular, cell === 4 ? 9 : 6.25, cell === 4 ? GREEN : INK, 7.8));
  });

  y = 268;
  section(page, "3. WARRANTY TERMS  (summary)", y, bold);
  const terms = [
    "Coverage periods and expiry dates are specified for each unit in this certificate and its continuation pages, subject to applicable manufacturer terms and conditions.",
    "Covers qualifying manufacturing defects and abnormal equipment failure during normal use.",
    "Excludes misuse, overloading, unauthorized modifications, third-party repairs, physical damage, flooding, fire, natural disasters and operation outside manufacturer specifications.",
    "Normal battery capacity and solar panel performance degradation within manufacturer specifications are not warranty defects.",
    `Detailed Terms & Conditions: ${TERMS_DISPLAY_URL}`,
  ];
  box(page, M, 146, 386, 104);
  let termsY = 237;
  for (const item of terms) termsY -= drawWrapped(page, item, M + 10, termsY, 366, regular, 6.5, INK, 8) + 4;
  box(page, 425, 146, 142, 104);
  try {
    const qr = await QRCode.toDataURL(snapshot.verificationUrl, { margin: 0, width: 180, errorCorrectionLevel: "M" });
    const match = qr.match(/^data:image\/png;base64,(.+)$/i);
    if (match) { const qrImage = await pdf.embedPng(Buffer.from(match[1], "base64")); page.drawImage(qrImage, { x: 438, y: 164, width: 65, height: 65 }); }
  } catch { /* The issued certificate remains valid if QR artwork cannot be rendered. */ }
  page.drawText("SCAN TO VERIFY WARRANTY", { x: 491, y: 230, size: 5.1, font: bold, color: MAROON });
  drawWrapped(page, `Status: ${options.preview ? "DRAFT" : (snapshot.coverageStatus || "ACTIVE").replaceAll("_", " ")}\n${snapshot.certificateNo}\n${snapshot.projectReference}`, 511, 217, 48, regular, 6.2, MUTED, 7.2);

  section(page, "4. AUTHORISED BY", 126, bold);
  box(page, M, 42, A4[0] - M * 2, 66);
  page.drawText("Installation Technician", { x: M + 10, y: 88, size: 7.5, font: bold, color: INK });
  page.drawText(snapshot.technicianName, { x: M + 10, y: 74, size: 7, font: regular, color: INK });
  page.drawText("Signature", { x: M + 10, y: 61, size: 6, font: regular, color: MUTED });
  if (technicianSignature) { const scale = Math.min(85 / technicianSignature.width, 18 / technicianSignature.height); page.drawImage(technicianSignature, { x: M + 58, y: 52, width: technicianSignature.width * scale, height: technicianSignature.height * scale }); }
  page.drawText(`Commissioned: ${formatDate(snapshot.commissioningDate)}`, { x: M + 10, y: 45, size: 6, font: regular, color: MUTED });
  page.drawText(options.preview ? "PREVIEW - NOT ISSUED" : "AUTHORISED & ISSUED BY", { x: 365, y: 88, size: 8, font: bold, color: GREEN });
  page.drawText(snapshot.authorisedByName || "Betech Solar Solutions", { x: 365, y: 75, size: 7, font: bold, color: INK });
  page.drawText(snapshot.authorisedByTitle || "Betech Solar Solutions", { x: 365, y: 64, size: 6.1, font: regular, color: INK });
  page.drawText(`Issue Date: ${formatDate(snapshot.issueDate)}`, { x: 365, y: 52, size: 6, font: regular, color: MUTED });
  if (authorisedSignature) { const scale = Math.min(100 / authorisedSignature.width, 16 / authorisedSignature.height); page.drawImage(authorisedSignature, { x: 365, y: 35, width: authorisedSignature.width * scale, height: authorisedSignature.height * scale }); }
  drawStamp(page, stamp, snapshot.issueDate, bold);
  page.drawText(`Issued warranty document • ${snapshot.certificateNo}`, { x: M, y: 20, size: 6.2, font: regular, color: MUTED });
  page.drawText("Betech Solar Solutions • Terms and conditions apply", { x: 324, y: 20, size: 6.2, font: regular, color: MUTED });
  for (let offset = 3; offset < snapshot.equipment.length; offset += 6) {
    const continuation = pdf.addPage(A4);
    continuation.drawText("EQUIPMENT WARRANTY DETAILS - CONTINUED", { x: M, y: 790, size: 13, font: bold, color: MAROON });
    continuation.drawText(snapshot.certificateNo, { x: M, y: 767, size: 10, font: bold, color: INK });
    snapshot.equipment.slice(offset, offset + 6).forEach((row, index) => {
      const top = 728 - index * 105;
      drawWrapped(continuation, `${offset + index + 1}. ${row.equipment} - ${row.brand} ${row.modelCapacity}`, M, top, 535, bold, 9, INK, 12);
      drawWrapped(continuation, `Serial: ${row.serialNumbers}`, M, top - 30, 535, regular, 8, INK, 11);
      continuation.drawText(`Warranty: ${row.warrantyYears} years | ${formatDate(row.warrantyStartDate)} to ${formatDate(row.warrantyExpiryDate)}`, { x: M, y: top - 67, size: 8, font: bold, color: GREEN });
    });
    continuation.drawText(`Part of ${snapshot.certificateNo} - Terms and conditions apply`, { x: M, y: 30, size: 7, font: regular, color: MUTED });
  }
  if (snapshot.equipment.length > 3) page.drawText("Additional equipment: see continuation pages", { x: M, y: 280, size: 7, font: bold, color: MAROON });
  const supportPage = pdf.addPage(A4);
  drawLetterhead(supportPage, letterheadImage);
  supportPage.drawText("CUSTOMER SUPPORT & WARRANTY ASSISTANCE", { x: M, y: 724, size: 15, font: bold, color: INK });
  supportPage.drawText(`Warranty Certificate: ${snapshot.certificateNo}   •   Project: ${snapshot.projectReference}`, { x: M, y: 706, size: 7.5, font: regular, color: MUTED });
  const supportCards = [
    { title: "SOLAR SYSTEM TERMS & CONDITIONS", url: TERMS_URL, copy: "This installation is governed by the Solar System Installation, Performance, Warranty & After-Sales Terms & Conditions." },
    { title: "WARRANTY SUPPORT", url: WARRANTY_SUPPORT_URL, copy: "Scan for warranty support, coverage guidance and the information needed for a warranty request." },
    { title: "REPORT AN ISSUE", url: REPORT_ISSUE_URL, copy: "Tell us what went wrong and provide the details our support team needs to assist you. You can track updates from your account after submitting your report." },
  ];
  for (const [index, card] of supportCards.entries()) {
    const top = 650 - index * 170;
    supportPage.drawRectangle({ x: M, y: top - 138, width: A4[0] - M * 2, height: 138, color: rgb(0.99, 0.99, 0.99), borderColor: rgb(0.84, 0.84, 0.84), borderWidth: 0.6 });
    supportPage.drawText(card.title, { x: M + 15, y: top - 22, size: 10, font: bold, color: MAROON });
    drawWrapped(supportPage, card.copy, M + 15, top - 42, 310, regular, 7.6, INK, 10);
    drawWrapped(supportPage, card.url.replace(/^https:\/\//, ""), M + 15, top - 104, 310, regular, 6.4, rgb(0.04, 0.42, 0.75), 8);
    try {
      const qr = await QRCode.toDataURL(card.url, { margin: 0, width: 220, errorCorrectionLevel: "M" });
      const match = qr.match(/^data:image\/png;base64,(.+)$/i);
      if (match) { const qrImage = await pdf.embedPng(Buffer.from(match[1], "base64")); supportPage.drawImage(qrImage, { x: 456, y: top - 122, width: 104, height: 104 }); }
    } catch { /* The support page remains useful if QR artwork cannot be generated. */ }
  }
  supportPage.drawText("Support: info@betech.co.ke  •  Call / WhatsApp: 0722 151 083  •  www.betech.co.ke", { x: M, y: 42, size: 7.2, font: bold, color: INK });
  return Buffer.from(await pdf.save());
}
