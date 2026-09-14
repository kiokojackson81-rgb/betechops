import "server-only";

import { readFile } from "fs/promises";
import path from "path";
import * as QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import { getBranding } from "@/lib/branding";
import { TERMS_DISPLAY_URL } from "@/lib/publicLinks";

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
  completionCertificateNo: string;
  projectReference: string;
  customerName: string;
  customerPhone: string;
  installationLocation: string;
  installationType: string;
  systemConfiguration: string;
  technicianName: string;
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

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const words = value.split(/\s+/).filter(Boolean);
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

function drawStamp(page: PDFPage, image: PDFImage | null, bold: PDFFont) {
  if (!image) return;
  const max = 90;
  const scale = Math.min(max / image.width, max / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x: 250 + (max - width) / 2, y: 55 + (max - height) / 2, width, height });
  page.drawText("DIGITALLY AUTHORISED", { x: 242, y: 44, size: 5.5, font: bold, color: MAROON });
}

/** Builds the single, compact issued warranty document from an immutable snapshot. */
export async function buildWarrantyCertificatePdf(snapshot: WarrantyCertificateSnapshot) {
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
  const stamp = branding.digitalStampEnabled && branding.digitalStampUrl ? await imageFromUrl(pdf, branding.digitalStampUrl) : null;
  drawLetterhead(page, letterheadImage);

  page.drawLine({ start: { x: M, y: 749 }, end: { x: A4[0] - M, y: 749 }, thickness: 3, color: MAROON });
  page.drawText("WARRANTY CERTIFICATE", { x: M, y: 712, size: 26, font: bold, color: MAROON });
  page.drawText("RELIABLE SOLAR SOLUTIONS. LONGER PEACE OF MIND.", { x: M, y: 696, size: 9, font: bold, color: MAROON });
  drawWrapped(page, "This certificate confirms that the commissioned solar system and listed equipment are covered by the stated manufacturer warranty periods, subject to the applicable Betech Solar Terms & Conditions.", M, 675, 340, regular, 8.4, INK, 11);
  box(page, 382, 651, 185, 75);
  [["Warranty Certificate No.", snapshot.certificateNo], ["Completion Certificate No.", snapshot.completionCertificateNo], ["Project Reference", snapshot.projectReference], ["Issue Date", formatDate(snapshot.issueDate)]].forEach(([label, value], index) => {
    const y = 710 - index * 17;
    page.drawText(label, { x: 390, y, size: 6.8, font: bold, color: INK });
    page.drawText(value, { x: 468, y, size: 6.8, font: bold, color: INK, maxWidth: 91 });
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
  snapshot.equipment.forEach((row, index) => {
    const top = 460 - index * 58;
    page.drawRectangle({ x: M, y: top - 58, width: A4[0] - M * 2, height: 58, color: index % 2 ? rgb(0.99, 0.99, 0.99) : PALE, borderColor: rgb(0.8, 0.82, 0.85), borderWidth: 0.4 });
    const values = [row.equipment, row.brand, row.modelCapacity, row.serialNumbers, `${row.warrantyYears} Years`, formatDate(row.warrantyStartDate), formatDate(row.warrantyExpiryDate)];
    values.forEach((value, cell) => drawWrapped(page, value || "Not recorded", cols[cell] + 4, top - 16, cols[cell + 1] - cols[cell] - 8, cell === 4 ? bold : regular, 6.25, cell === 4 ? GREEN : INK, 7.8));
  });

  y = 268;
  section(page, "3. WARRANTY TERMS  (summary)", y, bold);
  const terms = [
    "Solar Panels: 25 Years manufacturer warranty, subject to manufacturer terms and conditions.",
    "Lithium Battery: 10 Years manufacturer warranty, subject to manufacturer terms and conditions.",
    "Inverter: 5 Years manufacturer warranty, subject to manufacturer terms and conditions.",
    "This warranty covers manufacturing defects and abnormal failure under normal use. It does not cover misuse, overloading, unauthorised modifications, natural disasters, or third-party repairs.",
    `Detailed Terms & Conditions: ${TERMS_DISPLAY_URL}`,
  ];
  box(page, M, 146, 386, 104);
  terms.forEach((item, index) => { page.drawCircle({ x: M + 14, y: 235 - index * 19, size: 5.5, color: MAROON }); page.drawText(String(index + 1), { x: M + 12.4, y: 232.7 - index * 19, size: 5, font: bold, color: rgb(1, 1, 1) }); drawWrapped(page, item, M + 27, 235 - index * 19, 340, regular, 6.5, INK, 7.5); });
  box(page, 425, 146, 142, 104);
  try {
    const qr = await QRCode.toDataURL(snapshot.verificationUrl, { margin: 0, width: 180, errorCorrectionLevel: "M" });
    const match = qr.match(/^data:image\/png;base64,(.+)$/i);
    if (match) { const qrImage = await pdf.embedPng(Buffer.from(match[1], "base64")); page.drawImage(qrImage, { x: 438, y: 164, width: 65, height: 65 }); }
  } catch { /* The issued certificate remains valid if QR artwork cannot be rendered. */ }
  page.drawText("SCAN TO VERIFY", { x: 511, y: 218, size: 7.5, font: bold, color: MAROON });
  drawWrapped(page, "Verify certificate authenticity and warranty status online.", 511, 204, 48, regular, 6.2, MUTED, 7.2);

  section(page, "4. AUTHORISED BY", 126, bold);
  box(page, M, 42, A4[0] - M * 2, 66);
  page.drawText("For Betech Solar Solutions", { x: M + 10, y: 88, size: 7.5, font: bold, color: INK });
  page.drawText(`Technician: ${snapshot.technicianName}`, { x: M + 10, y: 74, size: 7, font: regular, color: INK });
  page.drawText(`Issue date: ${formatDate(snapshot.issueDate)}`, { x: M + 10, y: 61, size: 7, font: regular, color: INK });
  page.drawLine({ start: { x: 45, y: 52 }, end: { x: 190, y: 52 }, thickness: 0.6, color: MUTED });
  page.drawText("Authorised technician", { x: 45, y: 44, size: 6.2, font: regular, color: MUTED });
  page.drawLine({ start: { x: 380, y: 52 }, end: { x: 540, y: 52 }, thickness: 0.6, color: MUTED });
  page.drawText("Customer acceptance / handover", { x: 380, y: 44, size: 6.2, font: regular, color: MUTED });
  drawStamp(page, stamp, bold);
  page.drawText(`Issued warranty document • ${snapshot.certificateNo}`, { x: M, y: 20, size: 6.2, font: regular, color: MUTED });
  page.drawText("Betech Solar Solutions • Terms and conditions apply", { x: 324, y: 20, size: 6.2, font: regular, color: MUTED });
  return Buffer.from(await pdf.save());
}
