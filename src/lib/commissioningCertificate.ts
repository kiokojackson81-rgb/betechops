import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type CertificateSource = {
  certificateNo: string | null;
  issuedAt: Date | null;
  technician: { name: string | null } | null;
  data: unknown;
  receipt: {
    receiptNumber: string | null;
    data: unknown;
    order: { orderNumber: string; customerName: string | null; customerEmail: string | null; customerPhone: string | null; metadata: unknown } | null;
  };
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function splitLines(value: string, width = 82) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width && line) { lines.push(line); line = word; }
    else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}

async function letterheadBytes() {
  for (const candidate of [path.join(process.cwd(), "public", "letterhead.jpg"), path.join(process.cwd(), "letterhead.jpg")]) {
    try { return await readFile(candidate); } catch { /* try next path */ }
  }
  return null;
}

export async function buildCommissioningCertificatePdf(source: CertificateSource) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.08, 0.12, 0.18);
  const red = rgb(0.48, 0, 0);
  let y = 790;
  const letterhead = await letterheadBytes();
  if (letterhead) {
    try {
      const image = await pdf.embedJpg(letterhead);
      const scale = Math.min(545 / image.width, 120 / image.height);
      page.drawImage(image, { x: 25, y: y - image.height * scale, width: image.width * scale, height: image.height * scale });
      y -= image.height * scale + 20;
    } catch { /* the text brand header below remains available */ }
  }
  page.drawText("BETECH SOLAR SOLUTIONS", { x: 36, y, size: 11, font: bold, color: red });
  y -= 36;
  page.drawText("SOLAR PV COMPLETION & COMMISSIONING CERTIFICATE", { x: 36, y, size: 16, font: bold, color: ink });
  y -= 24;
  const certificateData = asRecord(source.data);
  const equipment = asRecord(certificateData.equipment);
  const measurements = asRecord(certificateData.measurements);
  const signatures = asRecord(certificateData.signatures);
  const receiptData = asRecord(source.receipt.data);
  const metadata = asRecord(source.receipt.order?.metadata);
  const reference = source.receipt.receiptNumber || source.receipt.order?.orderNumber || "Project";
  const location = text(receiptData.customerLocation) || text(receiptData.deliveryAddress) || text(metadata.customerLocation) || text(metadata.deliveryAddress) || "As recorded on project";
  const rows = [
    ["Certificate no.", source.certificateNo || "Pending"],
    ["Project reference", reference],
    ["Customer", source.receipt.order?.customerName || "Customer"],
    ["Location", location],
    ["Completion date", source.issuedAt ? source.issuedAt.toLocaleDateString("en-KE") : "—"],
    ["Panel equipment", text(equipment.panel) || "Recorded in commissioning evidence"],
    ["Inverter", text(equipment.inverter) || "Recorded in commissioning evidence"],
    ["Battery", text(equipment.battery) || "Recorded in commissioning evidence"],
    ["Technician", source.technician?.name || text(signatures.technician) || "Assigned technician"],
    ["Customer acceptance", text(signatures.customer) || "Captured at commissioning"],
  ];
  for (const [label, value] of rows) {
    page.drawText(label, { x: 36, y, size: 9, font: bold, color: red });
    const lines = splitLines(value, 70);
    lines.forEach((line, index) => page.drawText(line, { x: 180, y: y - index * 13, size: 9.5, font: regular, color: ink }));
    y -= Math.max(20, lines.length * 13 + 7);
  }
  y -= 5;
  page.drawText("Commissioning result", { x: 36, y, size: 11, font: bold, color: ink });
  y -= 17;
  page.drawText("Installation evidence and commissioning checks have been recorded for this project.", { x: 36, y, size: 9.5, font: regular, color: ink });
  y -= 30;
  const readings = Object.entries(measurements).filter(([, value]) => text(value));
  if (readings.length) {
    page.drawText("Recorded measurements", { x: 36, y, size: 11, font: bold, color: ink }); y -= 17;
    page.drawText(readings.map(([key, value]) => `${key}: ${String(value)}`).join("  •  ").slice(0, 160), { x: 36, y, size: 8.5, font: regular, color: ink }); y -= 25;
  }
  page.drawLine({ start: { x: 36, y }, end: { x: 559, y }, thickness: 0.7, color: rgb(0.75, 0.75, 0.75) });
  y -= 17;
  page.drawText("Betech Solar Installation Terms & Conditions: https://www.betech.co.ke/p/terms", { x: 36, y, size: 8, font: regular, color: ink });
  page.drawText("This is a system-generated certificate linked to the project evidence record.", { x: 36, y: 35, size: 8, font: regular, color: rgb(0.35, 0.38, 0.42) });
  return Buffer.from(await pdf.save());
}
