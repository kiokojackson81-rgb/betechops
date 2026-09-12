import { readFile } from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import { z } from "zod";
import { analyseSiteAssessment, ASSESSMENT_DESIGN_ASSUMPTIONS, type AssessmentLoadInput } from "@/lib/siteAssessmentAnalysis";

const text = (max: number) => z.string().trim().max(max);

export const siteAssessmentAiReviewSchema = z.object({
  summary: text(1200),
  observations: z.array(text(500)).max(8).default([]),
  risks: z.array(text(500)).max(8).default([]),
  recommendations: z.array(text(500)).max(8).default([]),
  dataGaps: z.array(text(500)).max(8).default([]),
});

export const siteAssessmentReportSchema = z
  .object({
    assessment: z.record(z.string(), z.unknown()),
    aiReview: siteAssessmentAiReviewSchema.nullable(),
    recommendation: z
      .object({
        type: z.enum(["CATALOG_PRODUCT", "CUSTOM_QUOTATION"]),
        productName: text(500).optional(),
        productUrl: z.string().trim().url().max(2000).optional(),
        productPrice: z.number().finite().nonnegative().max(100000000).optional(),
        productCategory: text(240).optional(),
        productShortDescription: text(2000).nullable().optional(),
        notes: text(2000).optional(),
        tiktokUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
      })
      .superRefine((value, ctx) => {
        if (value.type === "CATALOG_PRODUCT" && (!value.productName || !value.productUrl)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose a live catalog product or select a custom quotation." });
        }
        if (value.productUrl && !/^https:\/\/(www\.)?betech\.co\.ke\//i.test(value.productUrl)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Recommended product must be from the Betech website." });
        }
        if (value.tiktokUrl && !/^https:\/\/(www\.)?tiktok\.com\//i.test(value.tiktokUrl)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Similar-project link must be a TikTok URL." });
        }
      }),
    signatures: z
      .object({
        customerName: text(160).min(2),
        customerAccepted: z.literal(true),
        technicianName: text(160).min(2),
        technicianAccepted: z.literal(true),
      })
      .optional(),
    calculation: z.object({
      connectedKw: z.number().finite().nonnegative().max(100000),
      dailyKwh: z.number().finite().nonnegative().max(100000),
      inverterKw: z.number().finite().nonnegative().max(100000),
      batteryKwh: z.number().finite().nonnegative().max(100000),
      pvKw: z.number().finite().nonnegative().max(100000),
      panelCount: z.number().int().nonnegative().max(100000),
    }),
  })
  .strict();

export type SiteAssessmentReport = z.infer<typeof siteAssessmentReportSchema> & {
  version: number;
  submittedAt: string;
  submittedByName: string;
};

export function parseSiteAssessmentReport(value: unknown): SiteAssessmentReport | null {
  const parsed = siteAssessmentReportSchema.extend({
    version: z.number().int().positive(),
    submittedAt: z.string().datetime(),
    submittedByName: text(160),
  }).safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function reportRecommendationLabel(report: SiteAssessmentReport) {
  return report.recommendation.type === "CUSTOM_QUOTATION"
    ? "Custom quotation required"
    : report.recommendation.productName || "Betech catalog product";
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 34;
const INK = rgb(0.06, 0.1, 0.17);
const MUTED = rgb(0.37, 0.42, 0.5);
const RED = rgb(0.48, 0, 0.02);
const RED_SOFT = rgb(0.98, 0.93, 0.93);
const GOLD = rgb(0.93, 0.62, 0.04);
const GREEN = rgb(0.03, 0.43, 0.24);
const AMBER = rgb(0.72, 0.38, 0.02);
const BORDER = rgb(0.86, 0.87, 0.89);
const PALE = rgb(0.975, 0.976, 0.98);

type AssessmentRecord = Record<string, unknown>;
type AssessmentLoad = {
  name?: unknown;
  qty?: unknown;
  watts?: unknown;
  usageMode?: unknown;
  hours?: unknown;
  uses?: unknown;
  minutes?: unknown;
  period?: unknown;
  essential?: unknown;
  design?: unknown;
  details?: unknown;
};

const asRecord = (value: unknown): AssessmentRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as AssessmentRecord)
    : {};
const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) && value > 0 ? value : fallback;
const formatNumber = (value: number, digits = 2) =>
  value.toLocaleString("en-KE", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const money = (value: number) => `KES ${formatNumber(value, 0)}`;
const hasValue = (value: unknown) => {
  const item = clean(value);
  return Boolean(item && !["n/a", "none", "not entered", "undefined", "null"].includes(item.toLowerCase()));
};

function splitLines(value: string, font: PDFFont, size: number, width: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(line);
      line = word;
    } else line = candidate;
  });
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(page: PDFPage, value: string, x: number, y: number, width: number, font: PDFFont, size: number, color = INK, lineHeight = size + 3) {
  const lines = splitLines(value, font, size, width);
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * lineHeight, size, font, color }));
  return lines.length * lineHeight;
}

function drawRoundedBox(
  page: PDFPage,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: ReturnType<typeof rgb>;
    borderColor?: ReturnType<typeof rgb>;
    borderWidth?: number;
    borderRadius?: number;
  },
) {
  const { x, y, width, height, color, borderColor, borderWidth = 0, borderRadius = 7 } = options;
  const radius = Math.min(borderRadius, width / 2, height / 2);
  page.drawRectangle({ x: x + radius, y, width: width - radius * 2, height, color });
  page.drawRectangle({ x, y: y + radius, width, height: height - radius * 2, color });
  [[x + radius, y + radius], [x + width - radius, y + radius], [x + radius, y + height - radius], [x + width - radius, y + height - radius]].forEach(([centerX, centerY]) => {
    page.drawCircle({ x: centerX, y: centerY, size: radius, color });
  });
  if (borderColor && borderWidth) {
    page.drawRectangle({ x, y, width, height, borderColor, borderWidth });
  }
}

async function loadBetechLogo(document: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "agents", "betech-logo-crop.png"));
    return await document.embedPng(bytes);
  } catch {
    return null;
  }
}

function loadEnergyWh(load: AssessmentLoad) {
  const watts = numeric(load.watts);
  const qty = numeric(load.qty);
  const mode = clean(load.usageMode);
  if (!watts || !qty) return 0;
  if (mode === "ALWAYS_ON") return watts * qty * 24;
  if (mode === "EVENTS_DAILY") return watts * qty * numeric(load.uses) * numeric(load.minutes) / 60;
  if (mode === "EVENTS_WEEKLY") return watts * qty * numeric(load.uses) * numeric(load.minutes) / 60 / 7;
  return watts * qty * numeric(load.hours);
}

function loadUsage(load: AssessmentLoad) {
  const mode = clean(load.usageMode);
  if (mode === "ALWAYS_ON") return "24 hours";
  if (mode === "EVENTS_DAILY") return `${formatNumber(numeric(load.uses), 0)} × ${formatNumber(numeric(load.minutes), 0)} min/day`;
  if (mode === "EVENTS_WEEKLY") return `${formatNumber(numeric(load.uses), 0)} × ${formatNumber(numeric(load.minutes), 0)} min/week`;
  return `${formatNumber(numeric(load.hours), 1)} h/day`;
}

function loadName(load: AssessmentLoad) {
  const details = asRecord(load.details);
  const area = clean(details.area);
  return [clean(load.name) || "Recorded appliance", area].filter(Boolean).join(" — ");
}

export async function generateSiteAssessmentReportPdf(input: {
  visitRef: string;
  customerName: string;
  location: string;
  report: SiteAssessmentReport;
}) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadBetechLogo(document);
  const assessment = asRecord(input.report.assessment);
  const home = asRecord(assessment.home);
  const electrical = asRecord(assessment.electrical);
  const site = asRecord(assessment.siteDetails);
  const loads = Array.isArray(assessment.loads)
    ? assessment.loads.map((load) => asRecord(load) as AssessmentLoad)
    : [];
  const evidence = asRecord(assessment.evidenceNames);
  const analysis = analyseSiteAssessment({
    loads: loads as unknown as AssessmentLoadInput[],
    electrical,
    siteDetails: site,
    evidenceNames: evidence,
    selectedProduct: input.report.recommendation.type === "CATALOG_PRODUCT"
      ? { productName: input.report.recommendation.productName, productCategory: input.report.recommendation.productCategory, shortDescription: input.report.recommendation.productShortDescription, productUrl: input.report.recommendation.productUrl }
      : null,
  });
  const connectedKw = analysis.connectedKw;
  const dailyKwh = analysis.dailyKwh;
  const simultaneousPeakKw = analysis.simultaneousPeakKw;
  const inverterKw = analysis.inverterKw;
  const batteryKwh = analysis.batteryKwh;
  const pvKw = analysis.pvCalculatedKwp;
  const practicalPvKw = analysis.pvPracticalKwp;
  const panelCount = analysis.panelCount;
  const backupHours = finite(numeric(electrical.backupHours), 0);
  const monthlyKwh = dailyKwh * 30;
  const annualKwh = dailyKwh * 365;
  const essentialKw = analysis.loads.filter((load) => load.essential).reduce((total, load) => total + load.connectedKw, 0);
  const dayKwh = analysis.dayKwh;
  const nightKwh = analysis.nightKwh;
  const alwaysOnKw = analysis.continuousKw;
  const topLoads = [...analysis.loads].sort((a, b) => b.energyKwh - a.energyKwh).slice(0, 3).filter((load) => load.energyKwh > 0);
  const issuedAt = new Date(input.report.submittedAt);
  const issueDate = issuedAt.toLocaleDateString("en-KE", { dateStyle: "long" }).toUpperCase();
  const issueDateTime = issuedAt.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  const pages: PDFPage[] = [];
  let page = document.addPage(A4);
  let y = 760;
  pages.push(page);

  const drawHeader = (subtitle?: string) => {
    if (logo) {
      const scale = Math.min(92 / logo.width, 43 / logo.height);
      page.drawImage(logo, { x: MARGIN, y: 775, width: logo.width * scale, height: logo.height * scale });
    } else {
      page.drawCircle({ x: MARGIN + 11, y: 795, size: 11, color: GOLD });
      page.drawText("BETECH", { x: MARGIN + 28, y: 796, font: bold, size: 12, color: RED });
      page.drawText("SOLAR SOLUTIONS", { x: MARGIN + 28, y: 784, font: bold, size: 6.5, color: INK });
    }
    page.drawText("BETECH SOLAR SOLUTIONS", { x: 375, y: 798, font: bold, size: 7.5, color: RED });
    page.drawText("Technical solar assessment", { x: 401, y: 786, font: regular, size: 7, color: MUTED });
    page.drawLine({ start: { x: MARGIN, y: 766 }, end: { x: A4[0] - MARGIN, y: 766 }, color: BORDER, thickness: 0.8 });
    if (subtitle) {
      page.drawText(subtitle.toUpperCase(), { x: MARGIN, y: 744, font: bold, size: 8, color: RED });
      y = 724;
    } else y = 748;
  };
  const addPage = (subtitle?: string) => {
    page = document.addPage(A4);
    pages.push(page);
    drawHeader(subtitle);
  };
  const ensure = (height: number, subtitle = "Technical site assessment") => {
    if (y - height < 64) addPage(subtitle);
  };
  const section = (title: string) => {
    ensure(33, title);
    drawRoundedBox(page, { x: MARGIN, y: y - 21, width: A4[0] - MARGIN * 2, height: 21, color: RED, borderRadius: 5 });
    page.drawCircle({ x: MARGIN + 13, y: y - 10.5, size: 4.1, color: GOLD });
    page.drawText(title.toUpperCase(), { x: MARGIN + 25, y: y - 14, font: bold, size: 8.5, color: rgb(1, 1, 1) });
    y -= 33;
  };
  const card = (x: number, width: number, title: string, lines: Array<[string, string]>, tone: "plain" | "red" | "amber" = "plain") => {
    const visible = lines.filter(([, value]) => hasValue(value));
    const height = Math.max(
      77,
      32 + visible.reduce(
        (total, [, value]) => total + 21 + Math.max(0, splitLines(value, regular, 8.3, width - 28).length - 1) * 10,
        0,
      ),
    );
    const fill = tone === "red" ? RED : tone === "amber" ? rgb(1, 0.975, 0.91) : rgb(1, 1, 1);
    const stroke = tone === "red" ? RED : tone === "amber" ? rgb(0.94, 0.78, 0.37) : BORDER;
    drawRoundedBox(page, { x, y: y - height, width, height, color: fill, borderColor: stroke, borderWidth: 0.7, borderRadius: 8 });
    page.drawCircle({ x: x + 15, y: y - 16, size: 5, color: tone === "red" ? GOLD : RED });
    page.drawText(title.toUpperCase(), { x: x + 27, y: y - 19, font: bold, size: 7.5, color: tone === "red" ? rgb(1, 1, 1) : RED });
    let rowY = y - 37;
    visible.forEach(([label, value]) => {
      page.drawText(label.toUpperCase(), { x: x + 14, y: rowY, font: bold, size: 6.5, color: tone === "red" ? rgb(1, 0.92, 0.92) : MUTED });
      const valueLines = splitLines(value, regular, 8.3, width - 28);
      valueLines.slice(0, 2).forEach((line, index) => page.drawText(line, { x: x + 14, y: rowY - 10 - index * 10, font: index === 0 ? bold : regular, size: 8.3, color: tone === "red" ? rgb(1, 1, 1) : INK }));
      rowY -= 21 + Math.max(0, valueLines.length - 1) * 10;
    });
    return height;
  };
  const metric = (x: number, title: string, value: string, detail: string) => {
    const width = 164;
    drawRoundedBox(page, { x, y: y - 66, width, height: 66, color: rgb(1, 1, 1), borderColor: BORDER, borderWidth: 0.7, borderRadius: 8 });
    page.drawText(title.toUpperCase(), { x: x + 12, y: y - 17, font: bold, size: 6.6, color: RED });
    page.drawText(value, { x: x + 12, y: y - 35, font: bold, size: 14, color: INK });
    drawParagraph(page, detail, x + 12, y - 48, width - 24, regular, 6.4, MUTED, 7.8);
  };
  const labeledText = (title: string, value: string, tone: "green" | "amber" = "green") => {
    const lineHeight = 9;
    const lineCount = splitLines(value, regular, 7.4, A4[0] - MARGIN * 2 - 28).length;
    const height = Math.max(39, 29 + lineCount * lineHeight);
    ensure(height + 9, "Technical findings");
    drawRoundedBox(page, { x: MARGIN, y: y - height, width: A4[0] - MARGIN * 2, height, color: tone === "green" ? rgb(0.94, 0.985, 0.95) : rgb(1, 0.975, 0.91), borderColor: tone === "green" ? rgb(0.59, 0.82, 0.63) : rgb(0.94, 0.78, 0.37), borderWidth: 0.7, borderRadius: 8 });
    page.drawCircle({ x: MARGIN + 14, y: y - 14, size: 5, color: tone === "green" ? GREEN : AMBER });
    page.drawText(title.toUpperCase(), { x: MARGIN + 27, y: y - 17, font: bold, size: 7.2, color: tone === "green" ? GREEN : AMBER });
    drawParagraph(page, value, MARGIN + 14, y - 29, A4[0] - MARGIN * 2 - 28, regular, 7.4, INK, lineHeight);
    y -= height + 9;
  };

  drawHeader();
  drawRoundedBox(page, { x: MARGIN, y: y - 22, width: 198, height: 21, color: RED, borderRadius: 10 });
  page.drawText("TECHNICAL SITE ASSESSMENT REPORT", { x: MARGIN + 13, y: y - 14, font: bold, size: 7.4, color: rgb(1, 1, 1) });
  y -= 43;
  page.drawText("SOLAR PV SITE ASSESSMENT &", { x: MARGIN, y, font: bold, size: 20, color: INK });
  page.drawText("SYSTEM RECOMMENDATION", { x: MARGIN, y: y - 24, font: bold, size: 20, color: RED });
  y -= 43;
  const status = analysis.missingCriticalEvidence.length
    ? "ASSESSMENT COMPLETE — VERIFICATION REQUIRED"
    : input.report.signatures?.technicianAccepted
      ? "DIGITALLY SIGNED"
      : "ASSESSMENT SUBMITTED — SIGNATURE PENDING";
  const topMetrics: Array<[string, string]> = [["ASSESSMENT REFERENCE", input.visitRef], ["ASSESSMENT DATE", issueDate], ["STATUS", status]];
  topMetrics.forEach(([label, value], index) => {
    const x = MARGIN + index * 174;
    drawRoundedBox(page, { x, y: y - 47, width: 164, height: 47, color: PALE, borderColor: BORDER, borderWidth: 0.7, borderRadius: 7 });
    page.drawText(label, { x: x + 11, y: y - 15, font: bold, size: 6.3, color: RED });
    const lines = splitLines(value, bold, 8.6, 142);
    lines.slice(0, 2).forEach((line, lineIndex) => page.drawText(line, { x: x + 11, y: y - 29 - lineIndex * 10, font: bold, size: 8.6, color: INK }));
  });
  y -= 63;
  const cardWidth = (A4[0] - MARGIN * 2 - 20) / 3;
  const customerHeight = card(MARGIN, cardWidth, "Customer / project", [
    ["Customer", input.customerName], ["Location", input.location], ["Property", clean(home.type)], ["Bedrooms / units", [clean(home.bedrooms), clean(home.units) && `${clean(home.units)} unit(s)`].filter(Boolean).join(" · ")],
  ]);
  const teamHeight = card(MARGIN + cardWidth + 10, cardWidth, "Assessment team", [
    ["Site assessor", input.report.submittedByName], ["Assessment date", issueDateTime], ["Technical support", "0705 663 175"],
  ]);
  const objectiveHeight = card(MARGIN + (cardWidth + 10) * 2, cardWidth, "Project objective", [
    ["Customer goal", clean(electrical.systemGoal)], ["Backup requirement", backupHours ? `${formatNumber(backupHours, 1)} hours` : ""], ["Grid", clean(electrical.grid)], ["Supply", clean(site.supplyType)],
  ]);
  y -= Math.max(customerHeight, teamHeight, objectiveHeight) + 17;
  section("Energy assessment at a glance");
  const metrics = [
    ["Connected load", `${formatNumber(connectedKw)} kW`, "Total rating of recorded appliances."],
    ["Simultaneous peak", `${formatNumber(simultaneousPeakKw)} kW`, "Practical maximum expected together."],
    ["Daily consumption", `${formatNumber(dailyKwh)} kWh/day`, "Based on recorded usage patterns."],
    ["Monthly estimate", `${formatNumber(monthlyKwh, 0)} kWh`, "Indicative 30-day energy use."],
    ["Recommended inverter", `${formatNumber(inverterKw, 1)} kW`, "Includes operating reserve."],
    ["PV required", `${formatNumber(pvKw)} kWp`, `Calculated; practical selection ${formatNumber(practicalPvKw)} kWp (${panelCount || "Indicative"} × 600W).`],
  ];
  metrics.forEach(([title, value, detail], index) => {
    metric(MARGIN + (index % 3) * 174, String(title), String(value), String(detail));
    if (index % 3 === 2) y -= 76;
  });
  section("Assessment conclusion");
  const conclusion = input.report.aiReview?.summary || `The property has an estimated connected electrical load of ${formatNumber(connectedKw)} kW and a practical simultaneous demand of approximately ${formatNumber(simultaneousPeakKw)} kW. Recorded appliance usage indicates approximately ${formatNumber(dailyKwh)} kWh per day. The engineering calculation requires ${formatNumber(pvKw)} kWp of PV; the practical array selection is ${formatNumber(practicalPvKw)} kWp (${panelCount} × 600W panels). Battery storage is derived from recorded essential appliance runtime during the stated outage period, with conversion, depth-of-discharge and reserve allowances.`;
  const conclusionHeight = Math.max(78, splitLines(conclusion, regular, 9, A4[0] - MARGIN * 2 - 28).length * 13 + 30);
  drawRoundedBox(page, { x: MARGIN, y: y - conclusionHeight, width: A4[0] - MARGIN * 2, height: conclusionHeight, color: PALE, borderColor: BORDER, borderWidth: 0.7, borderRadius: 8 });
  drawParagraph(page, conclusion, MARGIN + 14, y - 20, A4[0] - MARGIN * 2 - 28, regular, 9, INK, 13);
  y -= conclusionHeight + 10;

  addPage("Detailed load assessment");
  page.drawText("Recorded appliances and consumption profile", { x: MARGIN, y, font: regular, size: 9, color: MUTED });
  y -= 18;
  const tableHeader = () => {
    const columns = [["#", MARGIN + 8], ["APPLIANCE", MARGIN + 27], ["QTY", MARGIN + 180], ["RATING", MARGIN + 207], ["LOAD", MARGIN + 252], ["USAGE", MARGIN + 300], ["ENERGY / DAY", MARGIN + 385], ["BACKUP", MARGIN + 468]];
    drawRoundedBox(page, { x: MARGIN, y: y - 18, width: A4[0] - MARGIN * 2, height: 18, color: RED, borderRadius: 4 });
    columns.forEach(([label, x]) => page.drawText(String(label), { x: Number(x), y: y - 12, font: bold, size: 5.8, color: rgb(1, 1, 1) }));
    y -= 20;
  };
  tableHeader();
  loads.forEach((load, index) => {
    if (y < 86) { addPage("Detailed load assessment"); tableHeader(); }
    const energy = analysis.loads[index]?.energyKwh || 0;
    const nameLines = splitLines(loadName(load), regular, 6.5, 145).slice(0, 2);
    const rowHeight = nameLines.length > 1 ? 30 : 22;
    page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: A4[0] - MARGIN * 2, height: rowHeight, color: index % 2 === 0 ? PALE : rgb(1, 1, 1) });
    page.drawText(String(index + 1), { x: MARGIN + 9, y: y - 14, font: regular, size: 6.5, color: MUTED });
    nameLines.forEach((line, lineIndex) => page.drawText(line, { x: MARGIN + 27, y: y - 11 - lineIndex * 8, font: lineIndex === 0 ? bold : regular, size: 6.5, color: INK }));
    const values = [[formatNumber(numeric(load.qty), 0), MARGIN + 182], [`${formatNumber(numeric(load.watts), 0)}W`, MARGIN + 207], [`${formatNumber(numeric(load.qty) * numeric(load.watts) / 1000)}kW`, MARGIN + 252], [loadUsage(load), MARGIN + 300], [`${formatNumber(energy)} kWh`, MARGIN + 386], [load.essential ? "Essential" : "Optional", MARGIN + 470]];
    values.forEach(([value, x]) => page.drawText(String(value), { x: Number(x), y: y - 14, font: regular, size: 5.8, color: INK, maxWidth: 74 }));
    y -= rowHeight;
  });
  if (!loads.length) labeledText("Load information required", "No appliance rows were captured in this assessment. The technical recommendation should be confirmed after load data is recorded.", "amber");
  ensure(37, "Detailed load assessment");
  drawRoundedBox(page, { x: MARGIN, y: y - 29, width: A4[0] - MARGIN * 2, height: 29, color: RED_SOFT, borderColor: rgb(0.75, 0.42, 0.42), borderWidth: 0.7, borderRadius: 5 });
  page.drawText(`TOTAL CONNECTED LOAD: ${formatNumber(connectedKw)} kW`, { x: MARGIN + 14, y: y - 18, font: bold, size: 8.5, color: RED });
  page.drawText(`ESTIMATED DAILY ENERGY: ${formatNumber(dailyKwh)} kWh/day`, { x: MARGIN + 283, y: y - 18, font: bold, size: 8.5, color: RED });
  y -= 43;
  section("Load profile and consumption analysis");
  const profileMetrics = [["Daytime load", `${formatNumber(dayKwh)} kWh/day`], ["Night load", `${formatNumber(nightKwh)} kWh/day`], ["24-hour load", `${formatNumber(alwaysOnKw)} kW`], ["Essential load", `${formatNumber(essentialKw)} kW`], ["Average hourly demand", `${formatNumber(dailyKwh / 24)} kW`], ["Peak utilisation", `${formatNumber(connectedKw ? simultaneousPeakKw / connectedKw * 100 : 0, 1)}%`]];
  profileMetrics.forEach(([title, value], index) => {
    metric(MARGIN + (index % 3) * 174, title, value, index === 5 ? "Peak diversity across recorded loads." : "Based on recorded load patterns.");
    if (index % 3 === 2) y -= 76;
  });
  const utilisation = connectedKw ? simultaneousPeakKw / connectedKw * 100 : 0;
  labeledText("Consumption analysis", `The connected load represents the combined rating of recorded appliances and should not be interpreted as continuous electrical consumption. Based on recorded usage patterns, approximately ${formatNumber(utilisation, 1)}% of the total connected load is expected to contribute to the practical peak demand.`);
  if (topLoads.length) {
    section("High energy loads");
    topLoads.forEach((load) => {
      const energy = load.energyKwh;
      const share = dailyKwh ? energy / dailyKwh * 100 : 0;
      labeledText(`Major energy consumer — ${loadName(load)}`, `Estimated ${formatNumber(energy)} kWh/day, contributing approximately ${formatNumber(share, 0)}% of recorded daily consumption. Frequent battery operation of this appliance will materially affect required solar generation and storage capacity.`, "amber");
    });
  }

  addPage("Preliminary system design");
  page.drawText("Design basis is derived from the field assessment and remains subject to final installation engineering.", { x: MARGIN, y, font: regular, size: 8.5, color: MUTED });
  y -= 18;
  const designWidth = (A4[0] - MARGIN * 2 - 12) / 2;
  const inverterHeight = card(MARGIN, designWidth, "Hybrid inverter", [["Recorded simultaneous peak", `${formatNumber(simultaneousPeakKw)} kW`], ["Design headroom", "25% operating reserve plus motor-start allowance where recorded"], ["Recommended standard size", `${formatNumber(inverterKw, 1)} kW hybrid inverter`], ["Status", inverterKw >= analysis.inverterRequiredKw ? "SUITABLE" : "TECHNICAL REVIEW REQUIRED"]], inverterKw >= analysis.inverterRequiredKw ? "plain" : "amber");
  const batteryHeight = card(MARGIN + designWidth + 12, designWidth, "Battery storage", [["Recorded essential backup energy", `${formatNumber(analysis.rawBackupEnergyKwh)} kWh`], ["Calculated nominal storage", `${formatNumber(analysis.calculatedBatteryKwh)} kWh`], ["Recommended standard storage", batteryKwh ? `${formatNumber(batteryKwh)} kWh lithium` : "BACKUP LOAD CONFIRMATION REQUIRED"], ["Usable delivered energy", batteryKwh ? `${formatNumber(analysis.usableBatteryKwh)} kWh` : ""], ["Expected essential backup", analysis.expectedBackupHours ? `${formatNumber(analysis.expectedBackupHours, 1)} hours` : ""]], batteryKwh && backupHours ? "plain" : "amber");
  y -= Math.max(inverterHeight, batteryHeight) + 13;
  const pvHeight = card(MARGIN, designWidth, "Solar PV array", [["Daily energy", `${formatNumber(dailyKwh)} kWh/day`], ["Calculated PV required", `${formatNumber(pvKw)} kWp`], ["Practical array selection", `${formatNumber(practicalPvKw)} kWp`], ["Indicative panels", panelCount ? `${panelCount} × 600W = ${formatNumber(practicalPvKw)} kWp` : ""], ["Expected solar production", `${formatNumber(analysis.expectedSolarProductionKwh)} kWh/day (${formatNumber(analysis.solarCoveragePercent, 0)}% of recorded use)`]]);
  const configurationHeight = card(MARGIN + designWidth + 12, designWidth, "System configuration", [["Configuration", clean(electrical.grid).toLowerCase().includes("off") ? "Solar + battery" : "Hybrid — grid + solar + battery"], ["Customer objective", clean(electrical.systemGoal)], ["Design focus", essentialKw ? "Selected essential loads during outages" : "Load and backup confirmation required"], ["System status", analysis.technicalReviewRequired ? "TECHNICAL REVIEW REQUIRED" : "PRELIMINARY RECOMMENDATION"]], "red");
  y -= Math.max(pvHeight, configurationHeight) + 15;
  section("Design basis");
  const basis = [["Peak sun hours", `${ASSESSMENT_DESIGN_ASSUMPTIONS.peakSunHours} h/day`], ["PV performance factor", `${ASSESSMENT_DESIGN_ASSUMPTIONS.pvPerformanceFactor * 100}%`], ["Battery factors", "92% efficiency · 90% DoD · 10% reserve"], ["Backup requirement", backupHours ? `${formatNumber(backupHours, 1)} hours` : "To be confirmed"]];
  basis.forEach(([label, value], index) => {
    const x = MARGIN + (index % 2) * 264;
    const rowY = y - Math.floor(index / 2) * 31;
    drawRoundedBox(page, { x, y: rowY - 24, width: 252, height: 24, color: PALE, borderColor: BORDER, borderWidth: 0.6, borderRadius: 6 });
    page.drawText(label.toUpperCase(), { x: x + 11, y: rowY - 10, font: bold, size: 6.3, color: MUTED });
    page.drawText(value, { x: x + 137, y: rowY - 11, font: bold, size: 7.7, color: INK });
  });
  y -= 73;
  labeledText("Engineering explanation", "The recommended inverter size uses the recorded simultaneous peak demand together with an operating reserve and motor-start allowance where applicable. Battery storage is calculated from each essential appliance's expected outage runtime, then adjusted for inverter efficiency, depth of discharge, reserve and operating margin. PV capacity is calculated independently, then rounded up to a real 600W-panel array.");
  section("Betech technical recommendation");
  const recommendation = reportRecommendationLabel(input.report);
  const hasValidatedCatalogMatch = input.report.recommendation.type === "CATALOG_PRODUCT" && analysis.productMatch.status === "PASS";
  const recommendationText = !hasValidatedCatalogMatch
    ? "CUSTOM SYSTEM REQUIRED — The assessment requirements do not currently match a standard Betech catalogue system. A custom quotation will be prepared from this technical assessment."
    : `RECOMMENDED BETECH SYSTEM — ${recommendation}`;
  drawRoundedBox(page, { x: MARGIN, y: y - 94, width: A4[0] - MARGIN * 2, height: 94, color: RED, borderRadius: 9 });
  page.drawText(recommendationText, { x: MARGIN + 17, y: y - 21, font: bold, size: 10, color: rgb(1, 1, 1), maxWidth: A4[0] - MARGIN * 2 - 34 });
  page.drawText(`${formatNumber(inverterKw, 1)} kW Hybrid Inverter  ·  ${formatNumber(batteryKwh)} kWh Lithium Storage  ·  ${panelCount || "Indicative"} × 600W Solar Panels (${formatNumber(practicalPvKw)} kWp)`, { x: MARGIN + 17, y: y - 49, font: bold, size: 8, color: rgb(1, 0.93, 0.93), maxWidth: A4[0] - MARGIN * 2 - 34 });
  drawParagraph(page, input.report.recommendation.notes || "This recommended configuration is aligned to the recorded practical demand, energy use and planned backup requirement. Final equipment selection and protection sizing are confirmed in the official quotation.", MARGIN + 17, y - 67, A4[0] - MARGIN * 2 - 34, regular, 7.5, rgb(1, 1, 1), 10);
  y -= 108;
  if (input.report.recommendation.productUrl) labeledText("Selected Betech product validation", `${recommendation}. Match status: ${analysis.productMatch.status}. ${analysis.productMatch.reasons.join(" ")} ${hasValidatedCatalogMatch ? "This standard system meets the recorded electrical requirements." : "Do not treat this selection as a final technical recommendation until Betech confirms the required specifications."}`, hasValidatedCatalogMatch ? "green" : "amber");
  if (input.report.recommendation.tiktokUrl) labeledText("Similar Betech project", `A comparable Betech project can be viewed at ${input.report.recommendation.tiktokUrl}`);

  addPage("Site conditions and next steps");
  const electricalHeight = card(MARGIN, cardWidth, "Electrical supply", [["Meter", clean(electrical.billing)], ["Grid status", clean(electrical.grid)], ["Supply type", clean(site.supplyType)], ["Main breaker", clean(site.mainBreakerRating)], ["Solar breaker space", clean(site.solarBreakerSlots)]]);
  const dbHeight = card(MARGIN + cardWidth + 10, cardWidth, "Earthing & DB", [["Existing wiring", clean(electrical.wiring)], ["Earthing", clean(site.earthingCondition)], ["Earthing notes", clean(site.earthWireNotes)], ["Status", clean(site.earthingCondition).toLowerCase().includes("confirm") ? "VERIFICATION REQUIRED" : "SUITABLE FOR REVIEW"]], clean(site.earthingCondition).toLowerCase().includes("confirm") ? "amber" : "plain");
  const roofHeight = card(MARGIN + (cardWidth + 10) * 2, cardWidth, "Roof & mounting", [["Roof type", clean(site.roofType)], ["Condition", clean(site.roofCondition)], ["Shading", clean(site.shading)], ["Access", clean(site.roofAccess)], ["Mounting", "Standard roof mounting"]]);
  y -= Math.max(electricalHeight, dbHeight, roofHeight) + 14;
  const roofArea = numeric(site.roofWidth) * numeric(site.roofLength);
  if (roofArea) {
    section("Roof capacity");
    labeledText("Roof layout review", `Usable roof area recorded: ${formatNumber(roofArea)} m². The indicative ${panelCount || "proposed"}-panel array requires final layout, structural and shading verification before quotation.`, roofArea >= Math.max(1, panelCount) * 2.2 ? "green" : "amber");
  }
  section("Equipment location and safety");
  const equipmentHeight = card(MARGIN, (A4[0] - MARGIN * 2 - 10) / 2, "Equipment placement", [["Inverter location", clean(site.inverterLocation)], ["Battery location", clean(site.batteryArea)], ["PV to inverter", clean(site.arrayToInverter) && `${clean(site.arrayToInverter)} m`], ["Inverter to DB", clean(site.inverterToDb) && `${clean(site.inverterToDb)} m`], ["Cable route", clean(site.cableRoute)]]);
  const safetyHeight = card(MARGIN + (A4[0] - MARGIN * 2 - 10) / 2 + 10, (A4[0] - MARGIN * 2 - 10) / 2, "Electrical protection", [["PV DC isolation", "Required"], ["DC surge protection", "Required"], ["AC protection", "Required"], ["Battery protection", batteryKwh ? "Required" : "Subject to final design"], ["Protective earthing", "Required"]], "red");
  y -= Math.max(equipmentHeight, safetyHeight) + 14;
  const evidenceLabels = analysis.evidenceLabels;
  section("Site evidence and technical findings");
  if (evidenceLabels.length) {
    labeledText("Evidence status", `${evidenceLabels.length} site-evidence item(s) were recorded: ${evidenceLabels.slice(0, 8).join(", ")}. ${analysis.missingCriticalEvidence.length ? `Verification is still required for: ${analysis.missingCriticalEvidence.join(", ")}.` : "Critical evidence is recorded; final installation checks remain required."} Evidence images and technical notes remain linked to the secure Betech site-visit workspace.`, analysis.missingCriticalEvidence.length ? "amber" : "green");
  } else {
    labeledText("Evidence status", "Site evidence was not included in this issued report. Capture meter, DB, earthing, roof and equipment evidence before final installation design.", "amber");
  }
  const findings = input.report.aiReview?.observations.length
    ? input.report.aiReview.observations
    : [
        `Recorded connected load is ${formatNumber(connectedKw)} kW with practical simultaneous demand of approximately ${formatNumber(simultaneousPeakKw)} kW.`,
        `Recorded use indicates approximately ${formatNumber(dailyKwh)} kWh/day of energy consumption.`,
        `${formatNumber(inverterKw, 1)} kW hybrid inverter capacity provides practical allowance for the recorded simultaneous demand.`,
        `The ${formatNumber(practicalPvKw)} kWp practical PV array is expected to produce about ${formatNumber(analysis.expectedSolarProductionKwh)} kWh/day in average conditions; actual production changes with weather, shading and season.`,
      ];
  findings.slice(0, 5).forEach((finding, index) => labeledText(`Finding ${String(index + 1).padStart(2, "0")}`, finding, index === 4 && !evidenceLabels.length ? "amber" : "green"));
  const outstanding = [...(input.report.aiReview?.risks || []), ...(input.report.aiReview?.dataGaps || [])];
  if (outstanding.length) {
    section("Items to confirm before quotation");
    outstanding.slice(0, 6).forEach((item) => labeledText("Technical confirmation required", item, "amber"));
  }
  section("Engineering advice and design readiness");
  analysis.loadAdvice.filter((item) => /high-heat|motor|air-conditioning|security\/connectivity|material energy/i.test(item.advice)).slice(0, 5).forEach((item) => labeledText(`Load guidance — ${item.name}`, item.advice, /motor|air-conditioning/.test(item.advice) ? "amber" : "green"));
  const objectiveAdvice = clean(electrical.systemGoal).toLowerCase().includes("off-grid")
    ? "Off-grid operation requires a seasonal energy review, demand control and a contingency plan before final approval. This preliminary design is not an off-grid guarantee."
    : clean(electrical.systemGoal).toLowerCase().includes("backup")
      ? "The battery design is intended for the recorded essential circuits during outages. High-heat appliances should remain on grid unless specifically designed into the backup scope."
      : "A grid-connected hybrid system is intended to reduce daytime grid energy while maintaining normal grid support when demand exceeds solar production.";
  labeledText("Operating objective", objectiveAdvice, analysis.technicalReviewRequired ? "amber" : "green");
  labeledText("Design readiness", analysis.technicalReviewRequired ? `TECHNICAL REVIEW REQUIRED — ${analysis.technicalReviewReasons.join(" ")}` : "DESIGN READINESS — Recorded loads, preliminary sizing and site evidence are sufficient for Betech to prepare the final quotation and installation design.", analysis.technicalReviewRequired ? "amber" : "green");
  section("Digital declaration and next steps");
  const signatureHeight = card(MARGIN, (A4[0] - MARGIN * 2 - 10) / 2, "Technician declaration", [["Status", input.report.signatures?.technicianAccepted ? "DIGITALLY SIGNED" : "ASSESSMENT SUBMITTED — SIGNATURE PENDING"], ["Site assessor", input.report.signatures?.technicianName || input.report.submittedByName], ["Assessment", input.visitRef], ["Signed", issueDateTime]], "plain");
  const customerSignatureHeight = card(MARGIN + (A4[0] - MARGIN * 2 - 10) / 2 + 10, (A4[0] - MARGIN * 2 - 10) / 2, "Customer acknowledgement", input.report.signatures ? [["Status", "DIGITALLY ACKNOWLEDGED"], ["Customer", input.report.signatures.customerName], ["Acknowledged", issueDateTime]] : [["Status", "PENDING"], ["Note", "Customer acknowledgement was not recorded in this issued report."]], input.report.signatures ? "plain" : "amber");
  y -= Math.max(signatureHeight, customerSignatureHeight) + 13;
  const nextSteps = [["1", "REVIEW", "Review this assessment and recommended system."], ["2", "QUOTATION", "Betech will prepare or confirm the final system quotation."], ["3", "INSTALLATION", "Once approved, project scheduling and installation can proceed."]];
  nextSteps.forEach(([number, title, detail], index) => {
    const x = MARGIN + index * 174;
    drawRoundedBox(page, { x, y: y - 64, width: 164, height: 64, color: PALE, borderColor: BORDER, borderWidth: 0.7, borderRadius: 8 });
    page.drawCircle({ x: x + 16, y: y - 16, size: 8, color: RED });
    page.drawText(number, { x: x + 13.8, y: y - 18.8, font: bold, size: 7, color: rgb(1, 1, 1) });
    page.drawText(title, { x: x + 30, y: y - 18, font: bold, size: 7.2, color: RED });
    drawParagraph(page, detail, x + 12, y - 34, 140, regular, 6.7, INK, 8);
  });
  y -= 78;
  labeledText("Customer notes", "This assessment is based on appliances, usage patterns and site conditions recorded during the visit. Actual energy consumption may vary with customer behaviour, weather, appliance changes and operating hours.");
  section("Terms and contact");
  const termsQr = await QRCode.toBuffer("https://www.betech.co.ke/p/terms", { margin: 1, width: 110 }).catch(() => null);
  if (termsQr) {
    const qr = await document.embedPng(termsQr);
    page.drawImage(qr, { x: MARGIN, y: y - 72, width: 60, height: 60 });
  }
  drawParagraph(page, "This report is a technical site assessment and preliminary system recommendation. Final equipment selection, protection ratings, cable sizing and installation scope are confirmed through the official quotation and final installation design.", MARGIN + 74, y - 14, 315, regular, 7.3, INK, 10);
  page.drawText("FULL TERMS & CONDITIONS", { x: MARGIN + 74, y: y - 50, font: bold, size: 7.2, color: RED });
  page.drawText("www.betech.co.ke/p/terms", { x: MARGIN + 74, y: y - 62, font: regular, size: 7.2, color: MUTED });
  page.drawText("Technical Support 0705 663 175  ·  Sales Desk 0722 151 083  ·  info@betech.co.ke", { x: MARGIN, y: y - 86, font: regular, size: 6.4, color: MUTED });
  page.drawText("Pramukh Plaza, 3rd Floor, Shop No. 3, Nairobi CBD  ·  www.betech.co.ke", { x: MARGIN, y: y - 97, font: regular, size: 6.4, color: MUTED });

  pages.forEach((item, index) => {
    item.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: A4[0] - MARGIN, y: 38 }, color: BORDER, thickness: 0.7 });
    item.drawText(`Assessment: ${input.visitRef}`, { x: MARGIN, y: 25, font: regular, size: 6.5, color: MUTED });
    const label = `Page ${index + 1} of ${pages.length}`;
    item.drawText(label, { x: A4[0] - MARGIN - bold.widthOfTextAtSize(label, 6.5), y: 25, font: bold, size: 6.5, color: RED });
  });
  return Buffer.from(await document.save());
}
