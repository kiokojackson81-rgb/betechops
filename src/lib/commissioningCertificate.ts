import { commissioningEquipmentUnits } from "@/lib/commissioningEquipment";
import { technicalConfiguration } from "@/lib/warrantyRules";
import { storedProjectDocument } from "@/lib/storedProjectDocument";
import { readFile } from "fs/promises";
import path from "path";
import * as QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import { decryptCommissioningToken } from "@/lib/commissioning";
import { getBranding, sameLicensedProfessional } from "@/lib/branding";
import { TERMS_DISPLAY_URL, TERMS_URL } from "@/lib/publicLinks";

type CertificateSource = {
  completionPdfUrl?: string | null;
  completionPdfSha256?: string | null;
  certificateNo: string | null;
  issuedAt: Date | null;
  customerTermsAcceptedAt?: Date | null;
  customerTokenCiphertext?: string | null;
  technician: { name: string | null } | null;
  technicianSignedAt?: Date | null;
  professionalApprovedAt?: Date | null;
  professionalReviewedBy?: string | null;
  professionalSignatureSnapshot?: string | null;
  professionalProfileSnapshot?: unknown;
  data: unknown;
  receipt: {
    receiptNumber: string | null;
    data: unknown;
    order: {
      orderNumber: string;
      customerName: string | null;
      customerEmail: string | null;
      customerPhone: string | null;
      metadata: unknown;
    } | null;
  };
};

type Evidence = { url?: string; fileName?: string; capturedAt?: string };
type EquipmentRow = { title: string; rows: Array<[string, string]> };

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 34;
const INK = rgb(0.12, 0.12, 0.13);
const MUTED = rgb(0.38, 0.39, 0.42);
const MAROON = rgb(0.45, 0.02, 0.04);
const GREY = rgb(0.95, 0.95, 0.95);
const GREEN = rgb(0.04, 0.45, 0.22);
const GREEN_LIGHT = rgb(0.9, 0.97, 0.92);
const WARRANTY_SUPPORT_URL = "https://www.betech.co.ke/warranty-support";
const REPORT_ISSUE_URL = "https://www.betech.co.ke/support/report-issue";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function valueFrom(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(record[key]);
    if (value && value.toLowerCase() !== "n/a") return value;
  }
  return "";
}

function splitLines(value: string, font: PDFFont, size: number, width: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function drawLines(page: PDFPage, value: string, x: number, y: number, width: number, font: PDFFont, size: number, color = INK, lineHeight = size + 2) {
  const lines = splitLines(value, font, size, width);
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * lineHeight, size, font, color }));
  return lines.length * lineHeight;
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", day: "2-digit", month: "long", year: "numeric" }) : "";
}

function formatStampDate(value: Date | null | undefined) {
  return value
    ? value
        .toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric" })
        .toUpperCase()
    : "";
}

async function letterheadBytes() {
  for (const candidate of [path.join(process.cwd(), "public", "letterhead.jpg"), path.join(process.cwd(), "letterhead.jpg")]) {
    try { return await readFile(candidate); } catch { /* Try the next approved company letterhead location. */ }
  }
  return null;
}

function drawLetterhead(page: PDFPage, image: PDFImage | null) {
  if (!image) return;
  const scale = Math.min(470 / image.width, 70 / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x: (A4[0] - width) / 2, y: 758, width, height });
}

function drawCheckMark(page: PDFPage, x: number, y: number, color = GREEN) {
  page.drawLine({ start: { x, y: y + 2 }, end: { x: x + 3, y: y - 1 }, thickness: 1.3, color });
  page.drawLine({ start: { x: x + 3, y: y - 1 }, end: { x: x + 8, y: y + 5 }, thickness: 1.3, color });
}

function drawCheckbox(page: PDFPage, x: number, y: number, checked: boolean, label: string, regular: PDFFont) {
  const size = 7;
  page.drawRectangle({
    x,
    y: y - 1,
    width: size,
    height: size,
    color: checked ? rgb(0.91, 0.97, 1) : rgb(0.98, 0.98, 0.98),
    borderColor: checked ? rgb(0.04, 0.42, 0.75) : rgb(0.72, 0.74, 0.77),
    borderWidth: 0.8,
  });
  if (checked) drawCheckMark(page, x - 0.3, y - 0.2, rgb(0.04, 0.42, 0.75));
  page.drawText(label, { x: x + 11, y, size: 6.6, font: regular, color: checked ? INK : MUTED });
}

function drawVerifiedBadge(page: PDFPage, bold: PDFFont) {
  const width = 164;
  const height = 25;
  const x = A4[0] - MARGIN - width;
  const y = 704;
  page.drawRectangle({ x, y, width, height, color: GREEN_LIGHT, borderColor: GREEN, borderWidth: 0.7 });
  drawCheckMark(page, x + 12, y + 8, rgb(0.04, 0.42, 0.75));
  page.drawText("COMMISSIONED & VERIFIED", { x: x + 25, y: y + 9, size: 8.1, font: bold, color: GREEN });
}

function drawDigitalStamp(page: PDFPage, stamp: PDFImage | null, stampDate: string, bold: PDFFont) {
  if (!stamp) return;
  const size = 46;
  const x = 505;
  const y = 34;
  const scale = Math.min(size / stamp.width, size / stamp.height);
  const width = stamp.width * scale;
  const height = stamp.height * scale;
  page.drawImage(stamp, { x: x + (size - width) / 2, y: y + (size - height) / 2, width, height });
  if (!stampDate) return;
  const dateLabel = `DATE: ${stampDate}`;
  const fontSize = 4.8;
  page.drawText(dateLabel, {
    x: x + (size - bold.widthOfTextAtSize(dateLabel, fontSize)) / 2,
    y: y + 2,
    size: fontSize,
    font: bold,
    color: rgb(0.08, 0.13, 0.68),
  });
}

function drawFooter(page: PDFPage, regular: PDFFont, pageNumber: number, totalPages: number) {
  page.drawLine({ start: { x: MARGIN, y: 28 }, end: { x: A4[0] - MARGIN, y: 28 }, thickness: 0.5, color: rgb(0.78, 0.78, 0.78) });
  const pageText = `Page ${pageNumber} of ${totalPages}`;
  page.drawText(pageText, { x: A4[0] - MARGIN - regular.widthOfTextAtSize(pageText, 6.5), y: 17, size: 6.5, font: regular, color: MUTED });
}

function drawSectionHeading(page: PDFPage, title: string, y: number, bold: PDFFont) {
  page.drawRectangle({ x: MARGIN, y: y - 3, width: 3, height: 12, color: MAROON });
  page.drawText(title.toUpperCase(), { x: MARGIN + 9, y, size: 8, font: bold, color: MAROON });
}

function drawDetailRows(page: PDFPage, rows: Array<[string, string]>, x: number, y: number, width: number, regular: PDFFont, bold: PDFFont) {
  let cursor = y;
  rows.filter(([, value]) => Boolean(value)).forEach(([label, value]) => {
    page.drawText(`${label}:`, { x, y: cursor, size: 7.3, font: bold, color: MUTED });
    const used = drawLines(page, value, x + 83, cursor, width - 83, regular, 7.5, INK, 9);
    cursor -= Math.max(11, used);
  });
  return cursor;
}

function getEvidence(data: Record<string, unknown>) {
  const raw = asRecord(data.evidence);
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value.map((entry) => asRecord(entry) as Evidence).filter((entry) => Boolean(text(entry.url))) : []])) as Record<string, Evidence[]>;
}

function extractEquipment(equipment: Record<string, unknown>, projectItems: string[]): EquipmentRow[] {
  const panelQuantity = valueFrom(equipment, ["panelQuantity", "panelQty", "panelCount"]);
  const panelRating = valueFrom(equipment, ["panelRating", "panelWatts", "panelWattage", "panelRatedPower"]);
  const panelWatts = Number((panelRating || projectItems.join(" ")).match(/(\d{3,4})\s*W/i)?.[1] || 0);
  const panelCount = Number(panelQuantity.match(/\d+/)?.[0] || projectItems.join(" ").match(/(\d+)\s*[x]/i)?.[1] || 0);
  const pvCapacity = panelWatts > 0 && panelCount > 0 ? `${((panelWatts * panelCount) / 1000).toFixed(2)} kWp` : "";
  const groups: EquipmentRow[] = [
    { title: "SOLAR ARRAY", rows: [["Brand", valueFrom(equipment, ["panelBrand"])], ["Model", valueFrom(equipment, ["panelModel"])], ["Panel rating", panelRating || (panelWatts ? `${panelWatts}W` : "")], ["Quantity", panelQuantity || (panelCount ? `${panelCount} Panels` : "")], ["Installed PV capacity", pvCapacity], ["Panel serial / reference", valueFrom(equipment, ["panelSerial", "panelReference"])]] },
    { title: "INVERTER", rows: [["Brand", valueFrom(equipment, ["inverterBrand"])], ["Model", valueFrom(equipment, ["inverterModel"])], ["Capacity", valueFrom(equipment, ["inverterCapacity", "inverterRating"])], ["Serial number", valueFrom(equipment, ["inverterSerial", "inverterSerialNumber"])]] },
    { title: "BATTERY", rows: [["Brand", valueFrom(equipment, ["batteryBrand"])], ["Model", valueFrom(equipment, ["batteryModel"])], ["Capacity", valueFrom(equipment, ["batteryCapacity", "batteryRating"])], ["Serial number", valueFrom(equipment, ["batterySerial", "batterySerialNumber"])], ["Quantity", valueFrom(equipment, ["batteryQuantity", "batteryQty"])]] },
  ];
  return groups.filter((group) => group.rows.some(([, value]) => Boolean(value)));
}

function checklistValue(checklist: Record<string, unknown>, keys: string[]) {
  return keys.map((key) => text(checklist[key])).find(Boolean) || "N/A";
}

function measurementRows(measurements: Record<string, unknown>) {
  const labels: Array<[string, string[]]> = [["PV Voltage", ["pvVoltage"]], ["Battery Voltage", ["batteryVoltage"]], ["Battery SOC at handover", ["batterySoc", "batterySOC"]], ["AC Input", ["acInput"]], ["AC Output", ["acOutput"]], ["Commissioning Load", ["commissioningLoad", "load"]]];
  return labels.map(([label, keys]) => [label, valueFrom(measurements, keys)] as [string, string]).filter(([, value]) => value && value.toLowerCase() !== "n/a");
}

function dataUrlBytes(value: string) {
  const match = value.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  return match ? { type: match[1].toLowerCase(), bytes: Buffer.from(match[2], "base64") } : null;
}

async function embedImage(pdf: PDFDocument, url: string) {
  try {
    let bytes: Uint8Array;
    let type = "";
    const inline = dataUrlBytes(url);
    if (inline) { bytes = inline.bytes; type = inline.type; }
    else {
      const response = await fetch(url);
      if (!response.ok) return null;
      bytes = new Uint8Array(await response.arrayBuffer());
      type = response.headers.get("content-type") || url;
    }
    return /png/i.test(type) ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
  } catch { return null; }
}

function certificateVerificationUrl(source: CertificateSource) {
  if (!source.customerTokenCiphertext) return "";
  try {
    const token = decryptCommissioningToken(source.customerTokenCiphertext);
    const origin = (process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || "https://ops.betech.co.ke").replace(/\/$/, "");
    return `${origin}/certificate/${token}`;
  } catch { return ""; }
}

function evidenceCaption(key: string, equipment: Record<string, unknown>) {
  const captions: Record<string, string> = {
    panelLabel: [valueFrom(equipment, ["panelBrand"]), valueFrom(equipment, ["panelModel"]), valueFrom(equipment, ["panelRating", "panelWatts"])].filter(Boolean).join(" - "),
    inverterLabel: [valueFrom(equipment, ["inverterBrand"]), valueFrom(equipment, ["inverterModel"]), valueFrom(equipment, ["inverterSerial", "inverterSerialNumber"])].filter(Boolean).join(" - "),
    batteryLabel: [valueFrom(equipment, ["batteryBrand"]), valueFrom(equipment, ["batteryModel"]), valueFrom(equipment, ["batterySerial", "batterySerialNumber"])].filter(Boolean).join(" - "),
  };
  return captions[key] || "Installation evidence recorded during commissioning.";
}

export async function buildCommissioningCertificatePdf(source: CertificateSource) {
  if (source.completionPdfUrl) return storedProjectDocument(source.completionPdfUrl, source.completionPdfSha256);
  const pdf = await PDFDocument.create();
  pdf.setTitle(source.certificateNo || "Betech Solar Completion & Commissioning Certificate");
  pdf.setAuthor("Betech Solar Solutions");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const certificateData = asRecord(source.data);
  const equipment = asRecord(certificateData.equipment);
  const measurements = asRecord(certificateData.measurements);
  const checklist = asRecord(certificateData.checklist);
  const handover = asRecord(certificateData.handover);
  const termsAcceptance = asRecord(certificateData.termsAcceptance);
  const signatures = asRecord(certificateData.signatures);
  const evidence = getEvidence(certificateData);
  const receiptData = asRecord(source.receipt.data);
  const metadata = asRecord(source.receipt.order?.metadata);
  const frozenProject = asRecord(certificateData.projectSnapshot);
  const reference = text(frozenProject.reference) || source.receipt.receiptNumber || source.receipt.order?.orderNumber || "Project";
  const customer = text(frozenProject.customerName) || source.receipt.order?.customerName || valueFrom(receiptData, ["customerName"]) || "Customer";
  const location = text(frozenProject.location) || valueFrom(receiptData, ["customerLocation", "deliveryAddress", "town"]) || valueFrom(metadata, ["customerLocation", "deliveryAddress"]) || "";
  const site = asRecord(certificateData.site);
  const installation = asRecord(certificateData.installation);
  const county = valueFrom(site, ["county"]) || valueFrom(receiptData, ["county", "customerCounty"]) || valueFrom(metadata, ["county"]);
  const gps = valueFrom(site, ["gps"]) || valueFrom(certificateData, ["gps", "gpsCoordinates"]) || valueFrom(receiptData, ["gps", "gpsCoordinates"]);
  const issuedDate = formatDate(source.technicianSignedAt || source.issuedAt);
  const termsAcceptedAt = text(termsAcceptance.acceptedAt) || source.customerTermsAcceptedAt?.toISOString() || "";
  const acceptanceDate = termsAcceptedAt ? new Date(termsAcceptedAt) : source.issuedAt;
  const signatureDate = formatDate(source.issuedAt);
  const acceptanceDateLabel = formatDate(acceptanceDate);
  const technicianSignatureDate = formatDate(
    text(signatures.technicianSignedAt)
      ? new Date(text(signatures.technicianSignedAt))
      : source.issuedAt,
  );
  const stampDate = formatStampDate(source.professionalApprovedAt || source.issuedAt);
  const technician = text(certificateData.installerName) || source.technician?.name || "Installer / agent";
  const page = pdf.addPage(A4);
  const letterhead = await letterheadBytes();
  let letterheadImage: PDFImage | null = null;
  if (letterhead) {
    try {
      letterheadImage = await pdf.embedJpg(letterhead);
    } catch {
      try { letterheadImage = await pdf.embedPng(letterhead); } catch { /* Certificate content remains available if the configured asset cannot be embedded. */ }
    }
  }
  const branding = await getBranding();
  const professionalSnapshot = asRecord(source.professionalProfileSnapshot);
  const professional = {
    name: valueFrom(professionalSnapshot, ["name"]) || branding.licensedProfessional.name,
    title: valueFrom(professionalSnapshot, ["title"]) || branding.licensedProfessional.title,
    qualification: valueFrom(professionalSnapshot, ["qualification"]) || branding.licensedProfessional.qualification,
    licenceNumber: valueFrom(professionalSnapshot, ["licenceNumber"]) || branding.licensedProfessional.licenceNumber,
    signatureUrl: text(source.professionalSignatureSnapshot) || valueFrom(professionalSnapshot, ["signatureUrl"]) || branding.licensedProfessional.signatureUrl || "",
  };
  const technicianIsProfessional = certificateData.installationCertifiedBySameProfessional === true || (certificateData.installationCertifiedBySameProfessional === undefined && sameLicensedProfessional(technician, professional.name));
  const approved = Boolean(source.professionalApprovedAt && valueFrom(professionalSnapshot, ["name"]));
  const professionalApprovalDate = formatDate(source.professionalApprovedAt);
  const storedStamp = text(professionalSnapshot.stampUrl) || (branding.digitalStampEnabled ? branding.digitalStampUrl : null);
  const stampImage = approved && storedStamp ? await embedImage(pdf, storedStamp) : null;
  drawLetterhead(page, letterheadImage);
  page.drawText("SOLAR PHOTOVOLTAIC SYSTEM", { x: MARGIN, y: 735, size: 16, font: bold, color: INK });
  page.drawText("COMPLETION & COMMISSIONING CERTIFICATE", { x: MARGIN, y: 715, size: 10, font: bold, color: INK });
  if (approved) drawVerifiedBadge(page, bold);
  else page.drawText("PROFESSIONAL APPROVAL NOT RECORDED", { x: 355, y: 707, size: 7, font: bold, color: MAROON });
  page.drawRectangle({ x: MARGIN, y: 674, width: A4[0] - MARGIN * 2, height: 27, color: GREY });
  [`Certificate No: ${source.certificateNo || "Pending"}`, `Project Ref: ${reference}`, `Completion Date: ${issuedDate || "As recorded"}`].forEach((line, index) => page.drawText(line, { x: MARGIN + 10 + index * 174, y: 684, size: 7.4, font: index === 0 ? bold : regular, color: INK }));

  const panel = (title: string, x: number, top: number, width: number, height: number) => {
    page.drawRectangle({ x, y: top - height, width, height, borderColor: MAROON, borderWidth: 0.55, color: rgb(1, 1, 1) });
    page.drawRectangle({ x, y: top - 17, width, height: 17, color: GREY });
    const titleWidth = Math.min(width, bold.widthOfTextAtSize(title, 7.3) + 18);
    page.drawRectangle({ x, y: top - 17, width: titleWidth, height: 17, color: MAROON });
    page.drawText(title, { x: x + 7, y: top - 11.5, font: bold, size: 7.3, color: rgb(1, 1, 1) });
  };
  const fullWidth = A4[0] - MARGIN * 2;
  panel("1. CUSTOMER & SITE DETAILS", MARGIN, 665, fullWidth, 83);
  drawDetailRows(page, [["Customer", customer], ["Phone", source.receipt.order?.customerPhone || ""], ["Location", location], ["County / GPS", [county, gps].filter(Boolean).join(" / ")]], MARGIN + 8, 638, 310, regular, bold);
  drawDetailRows(page, [["Technician", technician], [approved ? "Certified by" : "Review", approved ? professional.name : "Awaiting approval"], ["Handover date", acceptanceDateLabel]], 365, 638, 185, regular, bold);
  ["Residential", "Commercial", "Institutional", "Industrial", "Agricultural", "Other"].forEach((label, index) => drawCheckbox(page, MARGIN + 8 + index * 86, 589, site.premises === label, label === "Other" && text(site.premisesOther) ? `Other: ${text(site.premisesOther).slice(0, 12)}` : label, regular));

  panel("2. SYSTEM INSTALLED", MARGIN, 574, fullWidth, 84);
  const groups = extractEquipment(equipment, []);
  groups.slice(0, 3).forEach((group, index) => {
    const x = MARGIN + 8 + index * (fullWidth / 3);
    page.drawText(group.title, { x, y: 545, size: 8, font: bold, color: MAROON });
    group.rows.slice(0, 5).forEach(([label, value], row) => {
      page.drawText(`${label}:`, { x, y: 533 - row * 9, size: Math.min(6.5, 46 / Math.max(1, regular.widthOfTextAtSize(`${label}:`, 1))), font: regular, color: MUTED });
      const fit = Math.min(6.5, 105 / Math.max(1, regular.widthOfTextAtSize(value, 1)));
      page.drawText(value, { x: x + 48, y: 533 - row * 9, size: fit, font: regular, color: INK });
    });
  });
  panel("3. INSTALLATION TYPE", MARGIN, 482, fullWidth, 36);
  ["New Installation", "Upgrade", "Modification"].forEach((label, index) => drawCheckbox(page, MARGIN + 8 + index * 88, 455, installation.type === label, label, regular));
  ["Hybrid", "Off-Grid", "Grid-Tied"].forEach((label, index) => drawCheckbox(page, 330 + index * 77, 455, technicalConfiguration(installation.systemConfiguration) === `${label} Solar PV System`, label, regular));

  panel("4. COMMISSIONING RESULTS", MARGIN, 438, 190, 177);
  const inspectionRows: Array<[string, string]> = [["Visual installation inspection", Object.values(evidence).flat().length ? "PASS" : "N/A"], ["Inverter operation", checklistValue(checklist, ["Inverter powers ON"])], ["PV charging detected", checklistValue(checklist, ["PV charging detected"])], ["Battery charging", checklistValue(checklist, ["Battery charging"])], ["Battery discharging", checklistValue(checklist, ["Battery discharging"])], ["Grid input detected", checklistValue(checklist, ["Grid input detected"])], ["Backup / changeover tested", checklistValue(checklist, ["Backup/changeover tested"])], ["Protection devices installed", checklistValue(checklist, ["Protection devices installed"])], ["Earthing connected", checklistValue(checklist, ["Earthing connected"])], ["Monitoring configured", checklistValue(checklist, ["Monitoring configured"])]];
  inspectionRows.forEach(([label, result], index) => {
    const rowY = 412 - index * 12;
    page.drawRectangle({ x: MARGIN + 6, y: rowY - 3, width: 178, height: 11, color: index % 2 ? GREY : rgb(0.97, 0.98, 0.98) });
    page.drawText(label, { x: MARGIN + 10, y: rowY, size: 6.6, font: regular, color: INK });
    page.drawText(result, { x: MARGIN + 151, y: rowY, size: 7, font: bold, color: result === "PASS" ? GREEN : MUTED });
  });
  const passed = approved && Object.values(checklist).some(value => value === "PASS") && inspectionRows.every(([, result]) => result === "PASS" || result === "N/A");
  page.drawRectangle({ x: MARGIN + 6, y: 267, width: 178, height: 24, color: passed ? GREEN_LIGHT : GREY });
  page.drawText(passed ? "SYSTEM PASSED COMMISSIONING" : "COMMISSIONING REVIEW REQUIRED", { x: MARGIN + 12, y: 276, size: 7.2, font: bold, color: passed ? GREEN : MAROON });

  panel("5. MEASUREMENTS", 231, 438, 130, 177);
  measurementRows(measurements).slice(0, 7).forEach(([label, value], index) => {
    const rowY = 409 - index * 20;
    page.drawRectangle({ x: 236, y: rowY - 5, width: 120, height: 19, color: index % 2 ? GREY : rgb(0.98, 0.99, 1) });
    page.drawText(label, { x: 240, y: rowY, size: 6, font: regular, color: INK });
    page.drawText(value, { x: 318, y: rowY, size: 6, font: regular, color: INK });
  });
  panel("6. CUSTOMER HANDOVER", 368, 438, 193, 93);
  const handoverLabels: Array<[string, string]> = [["System operation explained", "System operation"], ["Shutdown / startup procedure", "Shutdown/startup"], ["Monitoring explained", "Monitoring"], ["Warranty explained", "Warranty"], ["Load limitations explained", "Load limitations"], ["Maintenance / panel cleaning", "Maintenance"], ["Fault reporting procedure", "Fault reporting"]];
  handoverLabels.forEach(([label, key], index) => drawCheckbox(page, 376, 412 - index * 9.5, handover[key] === true, label, regular));
  panel("7. CUSTOMER ACCEPTANCE", 368, 338, 193, 77);
  drawCheckbox(page, 376, 313, handoverLabels.every(([, key]) => handover[key] === true), "Customer handover completed", regular);
  drawCheckbox(page, 376, 302, termsAcceptance.accepted === true, "Terms & Conditions accepted", regular);
  drawLines(page, "Customer confirms acceptance of the installation, performance, warranty and after-sales terms.", 376, 291, 176, regular, 6, INK, 7);
  page.drawText(`Terms: ${TERMS_DISPLAY_URL}`, { x: 376, y: 273, size: 5.6, font: regular, color: rgb(0.04, 0.42, 0.75) });
  page.drawText(`Accepted: ${acceptanceDateLabel}`, { x: 376, y: 265, size: 5.6, font: regular, color: MUTED });

  panel("8. DECLARATION & PROFESSIONAL CERTIFICATION", MARGIN, 253, fullWidth, 90);
  page.drawText("Installation Technician Declaration", { x: MARGIN + 8, y: 226, size: 6.8, font: bold, color: MAROON });
  drawLines(page, "I confirm that I carried out the installation, testing and commissioning of the solar photovoltaic system described in this certificate. I further confirm that the equipment details, commissioning results, measurements and installation evidence recorded herein are true and accurate to the best of my knowledge.", MARGIN + 8, 217, fullWidth - 16, regular, 5.9, INK, 7);
  page.drawText("Professional Certification", { x: MARGIN + 8, y: 188, size: 6.8, font: bold, color: MAROON });
  drawLines(page, "Based on the recorded system configuration, equipment identification, commissioning results and supporting installation evidence, this Completion & Commissioning Certificate is authorised and certified on behalf of Betech Solar Solutions for handover to the customer.", MARGIN + 8, 179, fullWidth - 16, regular, 5.75, INK, 6.8);
  const y = 145;
  drawSectionHeading(page, "Signatures", y, bold);
  const signatureTop = y - 14;
  const customerSignature = text(signatures.customer);
  const technicianSignature = text(signatures.technician);
  const customerImage = customerSignature ? await embedImage(pdf, customerSignature) : null;
  const technicianImage = /^(data:image|https:\/\/)/.test(technicianSignature) ? await embedImage(pdf, technicianSignature) : null;
  const professionalImage = approved && professional.signatureUrl ? await embedImage(pdf, professional.signatureUrl) : null;
  const boxCount = technicianIsProfessional ? 2 : 3;
  const boxGap = 6;
  const boxWidth = (A4[0] - MARGIN * 2 - boxGap * (boxCount - 1)) / boxCount;
  const boxes = Array.from({ length: boxCount }, (_, index) => MARGIN + index * (boxWidth + boxGap));
  boxes.forEach((x) => page.drawRectangle({ x, y: signatureTop - 61, width: boxWidth, height: 65, color: rgb(0.99, 0.99, 0.99), borderColor: rgb(0.84, 0.84, 0.84), borderWidth: 0.4 }));
  page.drawText("CUSTOMER / REPRESENTATIVE", { x: boxes[0] + 6, y: signatureTop - 8, size: 6.3, font: bold, color: MAROON });
  page.drawText(`Name: ${customer}`, { x: boxes[0] + 6, y: signatureTop - 19, size: 6.2, font: regular, color: INK });
  if (customerImage) { const scale = Math.min((boxWidth - 20) / customerImage.width, 20 / customerImage.height); page.drawImage(customerImage, { x: boxes[0] + 12, y: signatureTop - 44, width: customerImage.width * scale, height: customerImage.height * scale }); }
  else page.drawText(customerSignature ? "Signature captured" : "Signature not recorded", { x: boxes[0] + 8, y: signatureTop - 38, size: 6.5, font: italic, color: MUTED });
  page.drawText(`Date: ${acceptanceDateLabel}`, { x: boxes[0] + 6, y: signatureTop - 53, size: 6.1, font: regular, color: MUTED });
  const professionalBox = technicianIsProfessional ? boxes[1] : boxes[2];
  if (!technicianIsProfessional) {
    page.drawText("INSTALLATION TECHNICIAN", { x: boxes[1] + 6, y: signatureTop - 8, size: 6.3, font: bold, color: MAROON });
    page.drawText(`Name: ${technician}`, { x: boxes[1] + 6, y: signatureTop - 19, size: 6.2, font: regular, color: INK });
    page.drawText("Installed, Tested & Commissioned By", { x: boxes[1] + 6, y: signatureTop - 28, size: 5.35, font: regular, color: MUTED });
    if (technicianImage) { const scale = Math.min((boxWidth - 20) / technicianImage.width, 18 / technicianImage.height); page.drawImage(technicianImage, { x: boxes[1] + 12, y: signatureTop - 47, width: technicianImage.width * scale, height: technicianImage.height * scale }); }
    else page.drawText(technicianSignature || technician, { x: boxes[1] + 8, y: signatureTop - 42, size: 7, font: italic, color: INK });
    page.drawText(`Date: ${technicianSignatureDate || signatureDate}`, { x: boxes[1] + 6, y: signatureTop - 53, size: 6.1, font: regular, color: MUTED });
  }
  page.drawText(technicianIsProfessional ? "INSTALLATION & PROFESSIONAL CERTIFICATION" : "SUPERVISED & CERTIFIED BY", { x: professionalBox + 6, y: signatureTop - 8, size: 5.9, font: bold, color: MAROON });
  page.drawText(approved ? professional.name : "Approval not recorded", { x: professionalBox + 6, y: signatureTop - 19, size: 6.6, font: bold, color: INK });
  page.drawText(approved ? professional.title : "", { x: professionalBox + 6, y: signatureTop - 28, size: 5.4, font: regular, color: INK });
  page.drawText(approved ? `${professional.qualification} · ${professional.licenceNumber}` : "", { x: professionalBox + 6, y: signatureTop - 35, size: 4.8, font: regular, color: INK });
  page.drawText("Signature", { x: professionalBox + 6, y: signatureTop - 42, size: 5.2, font: regular, color: MUTED });
  if (professionalImage) { const scale = Math.min((boxWidth - 18) / professionalImage.width, 12 / professionalImage.height); page.drawImage(professionalImage, { x: professionalBox + 10, y: signatureTop - 55, width: professionalImage.width * scale, height: professionalImage.height * scale }); }
  else page.drawText("Signature not recorded", { x: professionalBox + 8, y: signatureTop - 47, size: 8, font: italic, color: INK });
  page.drawText(`Certification Date: ${professionalApprovalDate || signatureDate}`, { x: professionalBox + 6, y: signatureTop - 64, size: 5.2, font: regular, color: MUTED });
  if (approved) drawDigitalStamp(page, stampImage, stampDate, bold);
  if (approved) page.drawText("Company Stamp", { x: 500, y: 22, size: 4.8, font: regular, color: MUTED });

  const verificationUrl = certificateVerificationUrl(source);
  if (verificationUrl) {
    try {
      const qr = await QRCode.toDataURL(verificationUrl, { margin: 0, width: 140, errorCorrectionLevel: "M" });
      const qrImage = await embedImage(pdf, qr);
      if (qrImage) { page.drawImage(qrImage, { x: 270, y: 40, width: 28, height: 28 }); page.drawText("SCAN TO VERIFY CERTIFICATE", { x: 232, y: 33, size: 4.5, font: bold, color: MAROON }); }
    } catch { /* A certificate remains valid even if QR generation is unavailable. */ }
  }

  if (Array.isArray(certificateData.additionalEquipment) && certificateData.additionalEquipment.length) {
    const units = commissioningEquipmentUnits(certificateData);
    for (let offset = 0; offset < units.length; offset += 8) {
      const unitPage = pdf.addPage(A4);
      drawLetterhead(unitPage, letterheadImage);
      unitPage.drawText("INSTALLED EQUIPMENT REGISTER", { x: MARGIN, y: 735, size: 14, font: bold, color: INK });
      unitPage.drawText(`Certificate: ${source.certificateNo || "Pending"}`, { x: MARGIN, y: 714, size: 9, font: regular, color: MUTED });
      units.slice(offset, offset + 8).forEach((unit, index) => {
        const top = 680 - index * 76;
        drawLines(unitPage, `${offset + index + 1}. ${unit.kind.toUpperCase()} - ${unit.brand} ${unit.model}`, MARGIN, top, 510, bold, 9);
        drawLines(unitPage, `Capacity: ${unit.capacity || "Not recorded"} | Serial: ${unit.serial || "Not recorded"}`, MARGIN, top - 22, 510, regular, 8);
        unitPage.drawText(`Warranty: ${unit.warrantyYears} years`, { x: MARGIN, y: top - 45, size: 8, font: regular, color: INK });
      });
    }
  }
  const evidenceOrder: Array<[string, string]> = [["panelLabel", "Solar Panel Manufacturer Label"], ["panelArray", "Completed Solar Array"], ["inverterLabel", "Inverter Manufacturer Label"], ["inverterInstallation", "Installed Inverter"], ["batteryLabel", "Battery Manufacturer Label"], ["batteryInstallation", "Installed Battery"], ["protection", "Protection / Distribution Equipment"], ["overall", "Completed Installation"]];
  const evidenceItems = evidenceOrder.flatMap(([key, label]) => (evidence[key] || []).map((item) => ({ key, label, item }))).filter(({ item }) => Boolean(text(item.url)));
  for (const unit of commissioningEquipmentUnits(certificateData)) {
    if (unit.id === unit.kind) continue;
    for (const item of unit.labelPhotos || []) if (item.url) evidenceItems.push({ key: `${unit.kind}Label`, label: `${unit.kind} - ${unit.serial}`, item });
  }
  let evidencePage: PDFPage | null = null;
  let evidenceY = 0;
  let evidenceIndex = 0;
  for (const evidenceItem of evidenceItems) {
    if (!evidencePage || evidenceIndex % 4 === 0) {
      evidencePage = pdf.addPage(A4);
      drawLetterhead(evidencePage, letterheadImage);
      evidencePage.drawText("INSTALLATION & COMMISSIONING EVIDENCE REPORT", { x: MARGIN, y: 735, size: 14, font: bold, color: INK });
      evidencePage.drawText(`Project: ${reference}     |     Certificate: ${source.certificateNo || "Pending"}     |     Customer: ${customer}`, { x: MARGIN, y: 719, size: 7, font: regular, color: MUTED });
      evidenceY = 690;
    }
    const column = evidenceIndex % 2;
    const row = Math.floor((evidenceIndex % 4) / 2);
    const x = MARGIN + column * 264;
    const top = evidenceY - row * 275;
    evidencePage.drawRectangle({ x, y: top - 248, width: 253, height: 252, color: rgb(0.99, 0.99, 0.99), borderColor: rgb(0.84, 0.84, 0.84), borderWidth: 0.5 });
    evidencePage.drawText(`PHOTO ${evidenceIndex + 1}`, { x: x + 8, y: top - 11, size: 7, font: bold, color: MAROON });
    evidencePage.drawText(evidenceItem.label, { x: x + 8, y: top - 22, size: 7, font: regular, color: INK });
    const image = await embedImage(pdf, text(evidenceItem.item.url));
    if (image) {
      const scale = Math.min(237 / image.width, 180 / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      evidencePage.drawImage(image, { x: x + (253 - width) / 2, y: top - 32 - height, width, height });
    } else evidencePage.drawText("Photo could not be embedded in this copy.", { x: x + 8, y: top - 116, size: 7, font: italic, color: MUTED });
    drawLines(evidencePage, evidenceCaption(evidenceItem.key, equipment), x + 8, top - 222, 237, regular, 6.5, MUTED, 8);
    evidenceIndex += 1;
  }
  if (!evidenceItems.length) {
    const evidenceFallback = pdf.addPage(A4);
    drawLetterhead(evidenceFallback, letterheadImage);
    evidenceFallback.drawText("INSTALLATION & COMMISSIONING EVIDENCE REPORT", { x: MARGIN, y: 735, size: 14, font: bold, color: INK });
    evidenceFallback.drawText("No evidence photos were available to include in this certificate copy.", { x: MARGIN, y: 705, size: 9, font: regular, color: MUTED });
  }
  const supportPage = pdf.addPage(A4);
  drawLetterhead(supportPage, letterheadImage);
  supportPage.drawText("CUSTOMER SUPPORT & PROJECT DOCUMENTS", { x: MARGIN, y: 724, size: 15, font: bold, color: INK });
  supportPage.drawText(`Completion Certificate: ${source.certificateNo || "Pending"}   •   Project: ${reference}`, { x: MARGIN, y: 706, size: 7.5, font: regular, color: MUTED });
  const supportCards = [
    { title: "SOLAR SYSTEM TERMS & CONDITIONS", url: TERMS_URL, copy: "This installation is governed by the Solar System Installation, Performance, Warranty & After-Sales Terms & Conditions." },
    { title: "WARRANTY SUPPORT", url: WARRANTY_SUPPORT_URL, copy: "Scan for warranty support, coverage guidance and the information needed for a warranty request." },
    { title: "REPORT AN ISSUE", url: REPORT_ISSUE_URL, copy: "Tell us what went wrong and provide the details our support team needs to assist you. You can track updates from your account after submitting your report." },
  ];
  for (const [index, card] of supportCards.entries()) {
    const top = 650 - index * 170;
    supportPage.drawRectangle({ x: MARGIN, y: top - 138, width: fullWidth, height: 138, color: rgb(0.99, 0.99, 0.99), borderColor: rgb(0.84, 0.84, 0.84), borderWidth: 0.6 });
    supportPage.drawText(card.title, { x: MARGIN + 15, y: top - 22, size: 10, font: bold, color: MAROON });
    drawLines(supportPage, card.copy, MARGIN + 15, top - 42, 310, regular, 7.6, INK, 10);
    drawLines(supportPage, card.url.replace(/^https:\/\//, ""), MARGIN + 15, top - 104, 310, regular, 6.4, rgb(0.04, 0.42, 0.75), 8);
    try {
      const qr = await QRCode.toDataURL(card.url, { margin: 0, width: 220, errorCorrectionLevel: "M" });
      const qrImage = await embedImage(pdf, qr);
      if (qrImage) supportPage.drawImage(qrImage, { x: 456, y: top - 122, width: 104, height: 104 });
    } catch { /* The support page remains useful if QR artwork cannot be generated. */ }
  }
  supportPage.drawText("Support: info@betech.co.ke  •  Call / WhatsApp: 0722 151 083  •  www.betech.co.ke", { x: MARGIN, y: 42, size: 7.2, font: bold, color: INK });
  const pages = pdf.getPages();
  pages.forEach((item, index) => drawFooter(item, regular, index + 1, pages.length));
  return Buffer.from(await pdf.save());
}
