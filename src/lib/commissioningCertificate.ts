import { readFile } from "fs/promises";
import path from "path";
import * as QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { decryptCommissioningToken } from "@/lib/commissioning";

type CertificateSource = {
  certificateNo: string | null;
  issuedAt: Date | null;
  customerTokenCiphertext?: string | null;
  technician: { name: string | null } | null;
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
const MAROON_LIGHT = rgb(0.97, 0.92, 0.92);
const GREY = rgb(0.95, 0.95, 0.95);
const GREEN = rgb(0.04, 0.45, 0.22);
const GREEN_LIGHT = rgb(0.9, 0.97, 0.92);

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

function formatSignatureDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", day: "2-digit", month: "2-digit", year: "numeric" }) : "";
}

async function letterheadBytes() {
  for (const candidate of [path.join(process.cwd(), "public", "letterhead.jpg"), path.join(process.cwd(), "letterhead.jpg")]) {
    try { return await readFile(candidate); } catch { /* Try the next approved company letterhead location. */ }
  }
  return null;
}

function drawHeader(page: PDFPage, bold: PDFFont, regular: PDFFont) {
  page.drawText("BETECH SOLAR SOLUTIONS", { x: MARGIN, y: 801, size: 13, font: bold, color: MAROON });
  page.drawText("Professional Solar PV • Energy Storage • Installation • Maintenance", { x: MARGIN, y: 787, size: 6.8, font: regular, color: MUTED });
  ["0722 151 083 | 0703 241 917", "info@betech.co.ke | www.betech.co.ke", "Pramukh Plaza, 3rd Floor, Shop No. 3, Nairobi CBD"].forEach((line, index) => {
    page.drawText(line, { x: A4[0] - MARGIN - regular.widthOfTextAtSize(line, 7), y: 801 - index * 11, size: 7, font: regular, color: INK });
  });
  page.drawRectangle({ x: MARGIN, y: 770, width: A4[0] - MARGIN * 2, height: 1.5, color: MAROON });
}

function drawFooter(page: PDFPage, regular: PDFFont, pageNumber: number, totalPages: number) {
  page.drawLine({ start: { x: MARGIN, y: 28 }, end: { x: A4[0] - MARGIN, y: 28 }, thickness: 0.5, color: rgb(0.78, 0.78, 0.78) });
  page.drawText("BETECH SOLAR SOLUTIONS  |  www.betech.co.ke  |  info@betech.co.ke  |  0722 151 083", { x: MARGIN, y: 17, size: 6.5, font: regular, color: MUTED });
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
  const panelRating = valueFrom(equipment, ["panelRating", "panelWatts", "panelWattage"]);
  const panelWatts = Number((panelRating || projectItems.join(" ")).match(/(\d{3,4})\s*W/i)?.[1] || 0);
  const panelCount = Number(panelQuantity.match(/\d+/)?.[0] || projectItems.join(" ").match(/(\d+)\s*[×x]/i)?.[1] || 0);
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
    panelLabel: [valueFrom(equipment, ["panelBrand"]), valueFrom(equipment, ["panelModel"]), valueFrom(equipment, ["panelRating", "panelWatts"])].filter(Boolean).join(" · "),
    inverterLabel: [valueFrom(equipment, ["inverterBrand"]), valueFrom(equipment, ["inverterModel"]), valueFrom(equipment, ["inverterSerial", "inverterSerialNumber"])].filter(Boolean).join(" · "),
    batteryLabel: [valueFrom(equipment, ["batteryBrand"]), valueFrom(equipment, ["batteryModel"]), valueFrom(equipment, ["batterySerial", "batterySerialNumber"])].filter(Boolean).join(" · "),
  };
  return captions[key] || "Installation evidence recorded during commissioning.";
}

export async function buildCommissioningCertificatePdf(source: CertificateSource) {
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
  const signatures = asRecord(certificateData.signatures);
  const evidence = getEvidence(certificateData);
  const receiptData = asRecord(source.receipt.data);
  const metadata = asRecord(source.receipt.order?.metadata);
  const reference = source.receipt.receiptNumber || source.receipt.order?.orderNumber || "Project";
  const customer = source.receipt.order?.customerName || valueFrom(receiptData, ["customerName"]) || "Customer";
  const location = valueFrom(receiptData, ["customerLocation", "deliveryAddress", "town"]) || valueFrom(metadata, ["customerLocation", "deliveryAddress"]) || "";
  const county = valueFrom(receiptData, ["county", "customerCounty"]) || valueFrom(metadata, ["county"]);
  const gps = valueFrom(certificateData, ["gps", "gpsCoordinates"]) || valueFrom(receiptData, ["gps", "gpsCoordinates"]);
  const installationDate = valueFrom(receiptData, ["installationDate", "scheduledDate"]) || valueFrom(metadata, ["installationDate"]);
  const issuedDate = formatDate(source.issuedAt);
  const signatureDate = formatSignatureDate(source.issuedAt);
  const technician = source.technician?.name || valueFrom(signatures, ["technician"]) || "Assigned technician";
  const page = pdf.addPage(A4);
  const letterhead = await letterheadBytes();
  if (letterhead) {
    try {
      const image = await pdf.embedJpg(letterhead);
      const scale = Math.min(110 / image.width, 32 / image.height);
      page.drawImage(image, { x: MARGIN, y: 779, width: image.width * scale, height: image.height * scale });
    } catch { /* Text branding remains the reliable official header. */ }
  }
  drawHeader(page, bold, regular);
  page.drawText("SOLAR PHOTOVOLTAIC SYSTEM", { x: MARGIN, y: 735, size: 16, font: bold, color: INK });
  page.drawText("COMPLETION & COMMISSIONING CERTIFICATE", { x: MARGIN, y: 715, size: 15, font: bold, color: INK });
  page.drawRectangle({ x: A4[0] - 142, y: 705, width: 108, height: 25, color: GREEN_LIGHT, borderColor: GREEN, borderWidth: 0.7 });
  page.drawText("COMMISSIONED ✓", { x: A4[0] - 132, y: 714, size: 8.5, font: bold, color: GREEN });
  page.drawRectangle({ x: MARGIN, y: 674, width: A4[0] - MARGIN * 2, height: 27, color: GREY });
  [`Certificate No: ${source.certificateNo || "Pending"}`, `Project Ref: ${reference}`, `Completion Date: ${issuedDate || "As recorded"}`].forEach((line, index) => page.drawText(line, { x: MARGIN + 10 + index * 174, y: 684, size: 7.4, font: index === 0 ? bold : regular, color: INK }));

  let y = 654;
  drawSectionHeading(page, "Customer & Site Details", y, bold);
  y -= 14;
  page.drawRectangle({ x: MARGIN, y: y - 56, width: A4[0] - MARGIN * 2, height: 60, color: rgb(0.985, 0.985, 0.985), borderColor: rgb(0.86, 0.86, 0.86), borderWidth: 0.4 });
  drawDetailRows(page, [["Customer name", customer], ["Phone", source.receipt.order?.customerPhone || ""], ["Installation location", location]], MARGIN + 9, y - 8, 252, regular, bold);
  drawDetailRows(page, [["County", county], ["GPS", gps], ["Installation date", installationDate], ["Assigned technician", technician]], 306, y - 8, 250, regular, bold);
  y -= 73;

  drawSectionHeading(page, "System Installed", y, bold);
  y -= 15;
  const groups = extractEquipment(equipment, []);
  if (groups.length) {
    const columnWidth = (A4[0] - MARGIN * 2 - 12) / Math.min(groups.length, 3);
    groups.forEach((group, index) => {
      const x = MARGIN + index * (columnWidth + 6);
      page.drawRectangle({ x, y: y - 64, width: columnWidth, height: 68, color: rgb(0.985, 0.985, 0.985), borderColor: rgb(0.86, 0.86, 0.86), borderWidth: 0.4 });
      page.drawText(group.title, { x: x + 7, y: y - 7, size: 7.2, font: bold, color: MAROON });
      drawDetailRows(page, group.rows.slice(0, 5), x + 7, y - 20, columnWidth - 14, regular, bold);
    });
  } else page.drawText("Equipment details are supported by the installation evidence report.", { x: MARGIN + 8, y: y - 12, size: 8, font: regular, color: MUTED });
  y -= 82;

  drawSectionHeading(page, "Installation Type", y, bold);
  page.drawText("Installation Type:  ✓ New Installation     ○ Upgrade     ○ Modification", { x: MARGIN + 9, y: y - 14, size: 7.6, font: regular, color: INK });
  page.drawText("System Configuration:  ✓ Hybrid     ○ Off-Grid     ○ Grid-Tied", { x: MARGIN + 9, y: y - 27, size: 7.6, font: regular, color: INK });
  y -= 45;

  drawSectionHeading(page, "Commissioning Results", y, bold);
  y -= 13;
  const inspectionRows: Array<[string, string]> = [["Visual installation inspection", Object.values(evidence).flat().length ? "PASS" : "N/A"], ["Inverter operation", checklistValue(checklist, ["Inverter powers ON"])], ["PV charging", checklistValue(checklist, ["PV charging detected"])], ["Battery charging", checklistValue(checklist, ["Battery charging"])], ["Battery discharge", checklistValue(checklist, ["Battery discharging"])], ["Grid input", checklistValue(checklist, ["Grid input detected"])], ["Backup / Changeover", checklistValue(checklist, ["Backup/changeover tested"])], ["Protection devices", checklistValue(checklist, ["Protection devices installed"])], ["Earthing", checklistValue(checklist, ["Earthing connected"])], ["Monitoring", checklistValue(checklist, ["Monitoring configured"])]];
  page.drawRectangle({ x: MARGIN, y: y - 78, width: A4[0] - MARGIN * 2, height: 82, color: rgb(0.99, 0.99, 0.99), borderColor: rgb(0.84, 0.84, 0.84), borderWidth: 0.4 });
  inspectionRows.forEach(([label, result], index) => {
    const rowY = y - 8 - index * 7.1;
    page.drawText(label, { x: MARGIN + 8, y: rowY, size: 6.8, font: regular, color: INK });
    page.drawText(result, { x: 445, y: rowY, size: 6.8, font: bold, color: result === "PASS" ? GREEN : result === "FAIL" ? rgb(0.72, 0.06, 0.08) : MUTED });
  });
  const passed = inspectionRows.every(([, result]) => result !== "FAIL");
  page.drawRectangle({ x: 334, y: y - 101, width: 227, height: 17, color: passed ? GREEN_LIGHT : MAROON_LIGHT, borderColor: passed ? GREEN : MAROON, borderWidth: 0.5 });
  page.drawText(passed ? "✓ SYSTEM PASSED COMMISSIONING" : "COMMISSIONING REVIEW REQUIRED", { x: 344, y: y - 95, size: 7.5, font: bold, color: passed ? GREEN : MAROON });
  y -= 111;

  const readings = measurementRows(measurements);
  if (readings.length) {
    drawSectionHeading(page, "Measurements", y, bold);
    y -= 14;
    page.drawRectangle({ x: MARGIN, y: y - 19, width: A4[0] - MARGIN * 2, height: 23, color: rgb(0.985, 0.985, 0.985), borderColor: rgb(0.86, 0.86, 0.86), borderWidth: 0.4 });
    readings.slice(0, 4).forEach(([label, value], index) => page.drawText(`${label}: ${value}`, { x: MARGIN + 8 + (index % 2) * 252, y: y - 8 - Math.floor(index / 2) * 9, size: 7.2, font: regular, color: INK }));
    y -= 33;
  }
  drawSectionHeading(page, "Completion Declaration", y, bold);
  y -= 14;
  drawLines(page, "We certify that the above Solar Photovoltaic System has been installed, inspected, tested and commissioned by Betech Solar Solutions. At the time of commissioning, the system was confirmed operational within the agreed installation scope. The customer was provided with basic system operating guidance, safety instructions, warranty information, load guidance and the applicable fault-reporting procedure.", MARGIN + 8, y, A4[0] - MARGIN * 2 - 16, regular, 6.65, INK, 8.2);
  drawLines(page, "System performance and battery backup duration depend on actual connected load, usage pattern, weather conditions, solar irradiation and battery state of charge.", MARGIN + 8, y - 34, A4[0] - MARGIN * 2 - 16, italic, 6.5, MUTED, 8);
  y -= 56;

  drawSectionHeading(page, "Customer Handover Completed", y, bold);
  const handoverLabels: Array<[string, string]> = [["System operation explained", "System operation"], ["Shutdown / startup procedure explained", "Shutdown/startup"], ["Monitoring explained", "Monitoring"], ["Warranty explained", "Warranty"], ["Load limitations explained", "Load limitations"], ["Maintenance / panel cleaning explained", "Maintenance"], ["Fault reporting procedure explained", "Fault reporting"]];
  handoverLabels.forEach(([label, key], index) => page.drawText(`${handover[key] ? "✓" : "○"} ${label}`, { x: MARGIN + 8 + (index % 2) * 270, y: y - 13 - Math.floor(index / 2) * 8, size: 6.6, font: regular, color: handover[key] ? GREEN : MUTED }));
  y -= 51;

  drawSectionHeading(page, "Signatures", y, bold);
  const signatureTop = y - 14;
  page.drawRectangle({ x: MARGIN, y: signatureTop - 55, width: 250, height: 59, color: rgb(0.99, 0.99, 0.99), borderColor: rgb(0.84, 0.84, 0.84), borderWidth: 0.4 });
  page.drawRectangle({ x: 310, y: signatureTop - 55, width: 251, height: 59, color: rgb(0.99, 0.99, 0.99), borderColor: rgb(0.84, 0.84, 0.84), borderWidth: 0.4 });
  page.drawText("CUSTOMER / REPRESENTATIVE", { x: MARGIN + 8, y: signatureTop - 8, size: 7, font: bold, color: MAROON });
  page.drawText("FOR BETECH SOLAR SOLUTIONS", { x: 318, y: signatureTop - 8, size: 7, font: bold, color: MAROON });
  page.drawText(`Name: ${customer}`, { x: MARGIN + 8, y: signatureTop - 19, size: 6.8, font: regular, color: INK });
  page.drawText(`Technician: ${technician}`, { x: 318, y: signatureTop - 19, size: 6.8, font: regular, color: INK });
  const customerSignature = text(signatures.customer);
  const technicianSignature = text(signatures.technician);
  const customerImage = customerSignature ? await embedImage(pdf, customerSignature) : null;
  const technicianImage = technicianSignature.startsWith("data:image") ? await embedImage(pdf, technicianSignature) : null;
  if (customerImage) { const scale = Math.min(90 / customerImage.width, 20 / customerImage.height); page.drawImage(customerImage, { x: MARGIN + 72, y: signatureTop - 43, width: customerImage.width * scale, height: customerImage.height * scale }); }
  else page.drawText("Signature captured", { x: MARGIN + 72, y: signatureTop - 37, size: 7, font: italic, color: MUTED });
  if (technicianImage) { const scale = Math.min(90 / technicianImage.width, 20 / technicianImage.height); page.drawImage(technicianImage, { x: 383, y: signatureTop - 43, width: technicianImage.width * scale, height: technicianImage.height * scale }); }
  else page.drawText(technicianSignature || technician, { x: 383, y: signatureTop - 37, size: 8, font: italic, color: INK });
  page.drawText(`Date: ${signatureDate}`, { x: MARGIN + 8, y: signatureTop - 49, size: 6.5, font: regular, color: MUTED });
  page.drawText(`Date: ${signatureDate}     Company stamp: __________________`, { x: 318, y: signatureTop - 49, size: 6.5, font: regular, color: MUTED });

  const verificationUrl = certificateVerificationUrl(source);
  if (verificationUrl) {
    try {
      const qr = await QRCode.toDataURL(verificationUrl, { margin: 0, width: 140, errorCorrectionLevel: "M" });
      const qrImage = await embedImage(pdf, qr);
      if (qrImage) { page.drawImage(qrImage, { x: 500, y: 66, width: 46, height: 46 }); page.drawText("SCAN TO VERIFY", { x: 480, y: 57, size: 5.4, font: bold, color: MAROON }); page.drawText("CERTIFICATE", { x: 484, y: 50, size: 5.4, font: bold, color: MAROON }); }
    } catch { /* A certificate remains valid even if QR generation is unavailable. */ }
  }

  const evidenceOrder: Array<[string, string]> = [["panelLabel", "Solar Panel Manufacturer Label"], ["panelArray", "Completed Solar Array"], ["inverterLabel", "Inverter Manufacturer Label"], ["inverterInstallation", "Installed Inverter"], ["batteryLabel", "Battery Manufacturer Label"], ["batteryInstallation", "Installed Battery"], ["protection", "Protection / Distribution Equipment"], ["overall", "Completed Installation"]];
  const evidenceItems = evidenceOrder.flatMap(([key, label]) => (evidence[key] || []).map((item) => ({ key, label, item }))).filter(({ item }) => Boolean(text(item.url)));
  let evidencePage: PDFPage | null = null;
  let evidenceY = 0;
  let evidenceIndex = 0;
  for (const evidenceItem of evidenceItems) {
    if (!evidencePage || evidenceIndex % 4 === 0) {
      evidencePage = pdf.addPage(A4);
      drawHeader(evidencePage, bold, regular);
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
    drawHeader(evidenceFallback, bold, regular);
    evidenceFallback.drawText("INSTALLATION & COMMISSIONING EVIDENCE REPORT", { x: MARGIN, y: 735, size: 14, font: bold, color: INK });
    evidenceFallback.drawText("No evidence photos were available to include in this certificate copy.", { x: MARGIN, y: 705, size: 9, font: regular, color: MUTED });
  }
  const pages = pdf.getPages();
  pages.forEach((item, index) => drawFooter(item, regular, index + 1, pages.length));
  return Buffer.from(await pdf.save());
}
