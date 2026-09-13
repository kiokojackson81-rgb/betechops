import { readFile } from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import { z } from "zod";
import { analyseSiteAssessment, ASSESSMENT_DESIGN_ASSUMPTIONS, type AssessmentLoadInput } from "@/lib/siteAssessmentAnalysis";
import { formatSiteVisitProjectType, formatSiteVisitReason, getSiteVisitProjectProfile } from "@/lib/siteVisitProjectProfiles";
import type { QuoteProjectType } from "@/lib/quoteRequests";
import type { SiteVisitReason } from "@/lib/siteVisitShared";

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

async function loadOfficialLetterhead(document: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "letterhead.jpg"));
    return await document.embedJpg(bytes);
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
  projectType?: QuoteProjectType | null;
  visitReason?: SiteVisitReason | null;
  report: SiteAssessmentReport;
}) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const letterhead = await loadOfficialLetterhead(document);
  const assessment = asRecord(input.report.assessment);
  const home = asRecord(assessment.home);
  const electrical = asRecord(assessment.electrical);
  const site = asRecord(assessment.siteDetails);
  const project = asRecord(assessment.project);
  const projectDetails = asRecord(project.details);
  // Reports issued before project types were introduced were all home-solar
  // assessments, so preserve their established five-page solar design report.
  const projectType = (input.projectType || clean(project.projectType) || "SOLAR_HOME_SYSTEM") as QuoteProjectType;
  const visitReason = (input.visitReason || clean(project.visitReason) || "OTHER") as SiteVisitReason;
  const projectProfile = getSiteVisitProjectProfile(projectType);
  const projectTypeLabel = clean(project.projectTypeLabel) || formatSiteVisitProjectType(projectType);
  const visitReasonLabel = clean(project.visitReasonLabel) || formatSiteVisitReason(visitReason);
  const projectRequirement = clean(project.customerRequirements);
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

  const drawHeader = (subtitle?: string, official = false) => {
    if (official && letterhead) {
      const scale = Math.min((A4[0] - MARGIN * 2) / letterhead.width, 72 / letterhead.height);
      const width = letterhead.width * scale;
      const height = letterhead.height * scale;
      page.drawImage(letterhead, { x: (A4[0] - width) / 2, y: 760, width, height });
      page.drawLine({ start: { x: MARGIN, y: 752 }, end: { x: A4[0] - MARGIN, y: 752 }, color: BORDER, thickness: 0.7 });
    } else {
      page.drawText("BETECH SOLAR SOLUTIONS", { x: MARGIN, y: 804, font: bold, size: 7.8, color: RED });
      page.drawText("Technical site assessment report", { x: MARGIN, y: 793, font: regular, size: 6.8, color: MUTED });
      page.drawText("Reliable Energy Today. A Brighter Tomorrow.", { x: 380, y: 804, font: bold, size: 5.8, color: RED });
      page.drawLine({ start: { x: MARGIN, y: 784 }, end: { x: A4[0] - MARGIN, y: 784 }, color: BORDER, thickness: 0.7 });
    }
    if (subtitle) {
      page.drawText(subtitle.toUpperCase(), { x: MARGIN, y: official ? 733 : 766, font: bold, size: 8, color: RED });
      y = official ? 715 : 750;
    } else y = official ? 736 : 770;
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
  const cardHeight = (width: number, lines: Array<[string, string]>) => {
    const visible = lines.filter(([, value]) => hasValue(value));
    return Math.max(
      64,
      32 + visible.reduce(
        (total, [, value]) => total + 21 + Math.max(0, splitLines(value, regular, 8.3, width - 28).length - 1) * 10,
        0,
      ),
    );
  };
  const card = (x: number, width: number, title: string, lines: Array<[string, string]>, tone: "plain" | "red" | "amber" = "plain", fixedHeight?: number) => {
    const visible = lines.filter(([, value]) => hasValue(value));
    const height = fixedHeight || cardHeight(width, lines);
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
  const finishDocument = async () => {
    pages.forEach((item, index) => {
      item.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: A4[0] - MARGIN, y: 38 }, color: BORDER, thickness: 0.7 });
      item.drawText(input.visitRef, { x: MARGIN, y: 25, font: regular, size: 6.5, color: MUTED });
      item.drawText("Betech Solar Solutions", { x: (A4[0] - regular.widthOfTextAtSize("Betech Solar Solutions", 6.5)) / 2, y: 25, font: regular, size: 6.5, color: MUTED });
      const label = `Page ${index + 1} of ${pages.length}`;
      item.drawText(label, { x: A4[0] - MARGIN - bold.widthOfTextAtSize(label, 6.5), y: 25, font: bold, size: 6.5, color: RED });
    });
    return Buffer.from(await document.save());
  };

  drawHeader(undefined, true);
  page.drawText("TECHNICAL SITE ASSESSMENT REPORT", { x: (A4[0] - bold.widthOfTextAtSize("TECHNICAL SITE ASSESSMENT REPORT", 7.6)) / 2, y: y - 9, font: bold, size: 7.6, color: RED });
  page.drawText(projectProfile.reportTitle, { x: (A4[0] - bold.widthOfTextAtSize(projectProfile.reportTitle, 18)) / 2, y: y - 33, font: bold, size: 18, color: INK });
  page.drawText("& TECHNICAL RECOMMENDATION", { x: (A4[0] - bold.widthOfTextAtSize("& TECHNICAL RECOMMENDATION", 17)) / 2, y: y - 54, font: bold, size: 17, color: RED });
  y -= 71;
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
  const customerLines: Array<[string, string]> = [
    ["Customer", input.customerName], ["Location", input.location], ["Project", projectTypeLabel], ["Property", clean(project.propertyType) || clean(home.type)],
  ];
  const teamLines: Array<[string, string]> = [
    ["Site assessor", input.report.submittedByName], ["Assessment date", issueDateTime], ["Technical support", "0705 663 175"],
  ];
  const objectiveLines: Array<[string, string]> = [
    ["Visit reason", visitReasonLabel], ["Customer request", projectRequirement], ["Project focus", projectProfile.title], ["Grid / supply", [clean(electrical.grid), clean(site.supplyType)].filter(Boolean).join(" · ")],
  ];
  const executiveCardHeight = Math.max(cardHeight(cardWidth, customerLines), cardHeight(cardWidth, teamLines), cardHeight(cardWidth, objectiveLines));
  card(MARGIN, cardWidth, "Customer / project", customerLines, "plain", executiveCardHeight);
  card(MARGIN + cardWidth + 10, cardWidth, "Assessment team", teamLines, "plain", executiveCardHeight);
  card(MARGIN + (cardWidth + 10) * 2, cardWidth, "Project objective", objectiveLines, "plain", executiveCardHeight);
  y -= executiveCardHeight + 17;
  section(projectProfile.usesLoadSizing ? "Energy assessment at a glance" : "Project assessment at a glance");
  const projectMetrics = Object.entries(projectDetails)
    .filter(([, value]) => hasValue(value))
    .slice(0, 6)
    .map(([key, value]) => [key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()), clean(value), "Recorded during the field assessment."]);
  const metrics = projectProfile.usesLoadSizing ? [
    ["Connected load", `${formatNumber(connectedKw)} kW`, "Total rating of recorded appliances."],
    ["Simultaneous peak", `${formatNumber(simultaneousPeakKw)} kW`, "Practical maximum expected together."],
    ["Daily consumption", `${formatNumber(dailyKwh)} kWh/day`, "Based on recorded usage patterns."],
    ["Monthly estimate", `${formatNumber(monthlyKwh, 0)} kWh`, "Indicative 30-day energy use."],
    ["Recommended inverter", `${formatNumber(inverterKw, 1)} kW`, "Includes operating reserve."],
    ["PV required", `${formatNumber(pvKw)} kWp`, `Calculated; practical selection ${formatNumber(practicalPvKw)} kWp (${panelCount || "Indicative"} × 600W).`],
  ] : (projectMetrics.length ? projectMetrics : [
    ["Project type", projectTypeLabel, "Recorded site-visit category."],
    ["Visit reason", visitReasonLabel, "Requested technical service."],
    ["Customer request", projectRequirement || "To be confirmed", "Scope recorded at booking."],
  ]);
  metrics.forEach(([title, value, detail], index) => {
    metric(MARGIN + (index % 3) * 174, String(title), String(value), String(detail));
    if (index % 3 === 2) y -= 76;
  });
  section("Assessment conclusion");
  const conclusion = input.report.aiReview?.summary || (projectProfile.usesLoadSizing
    ? `The property has an estimated connected electrical load of ${formatNumber(connectedKw)} kW and a practical simultaneous demand of approximately ${formatNumber(simultaneousPeakKw)} kW. Recorded appliance usage indicates approximately ${formatNumber(dailyKwh)} kWh per day. The engineering calculation requires ${formatNumber(pvKw)} kWp of PV; the practical array selection is ${formatNumber(practicalPvKw)} kWp (${panelCount} × 600W panels). Battery storage is derived from recorded essential appliance runtime during the stated outage period, with conversion, depth-of-discharge and reserve allowances.`
    : `This ${projectTypeLabel.toLowerCase()} assessment records the site requirements for ${visitReasonLabel.toLowerCase()}. Betech will use the recorded site observations, evidence and project-specific details to prepare the appropriate technical recommendation or quotation.`);
  const conclusionHeight = Math.max(78, splitLines(conclusion, regular, 9, A4[0] - MARGIN * 2 - 28).length * 13 + 30);
  drawRoundedBox(page, { x: MARGIN, y: y - conclusionHeight, width: A4[0] - MARGIN * 2, height: conclusionHeight, color: PALE, borderColor: BORDER, borderWidth: 0.7, borderRadius: 8 });
  drawParagraph(page, conclusion, MARGIN + 14, y - 20, A4[0] - MARGIN * 2 - 28, regular, 9, INK, 13);
  y -= conclusionHeight + 10;

  // Water heating, pumping, commercial and diagnostic visits are not PV load-sizing
  // exercises. Their report records the actual field scope rather than inventing a
  // zero-kW solar design when appliance loads were not collected.
  if (!projectProfile.usesLoadSizing) {
    const detailLines: Array<[string, string]> = Object.entries(projectDetails)
      .filter(([, value]) => hasValue(value))
      .map(([key, value]) => [key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()), clean(value)]);
    const observedDetails: Array<[string, string]> = detailLines.length
      ? detailLines
      : [["Project type", projectTypeLabel], ["Visit reason", visitReasonLabel], ["Customer request", projectRequirement || "To be confirmed on site"]];

    addPage("Project requirements & field observations");
    page.drawText("Project-specific observations captured for the requested visit.", { x: MARGIN, y, font: regular, size: 9, color: MUTED });
    y -= 18;
    section("Recorded project requirements");
    const requirementWidth = (A4[0] - MARGIN * 2 - 10) / 2;
    for (let index = 0; index < observedDetails.length; index += 2) {
      const left = observedDetails[index];
      const right = observedDetails[index + 1];
      const leftHeight = cardHeight(requirementWidth, [[left[0], left[1]]]);
      const rightHeight = right ? cardHeight(requirementWidth, [[right[0], right[1]]]) : 0;
      const rowHeight = Math.max(leftHeight, rightHeight);
      card(MARGIN, requirementWidth, left[0], [["Recorded", left[1]]], "plain", rowHeight);
      if (right) card(MARGIN + requirementWidth + 10, requirementWidth, right[0], [["Recorded", right[1]]], "plain", rowHeight);
      y -= rowHeight + 9;
    }
    section("Scope and recommendation basis");
    labeledText("Visit purpose", `${visitReasonLabel}. ${projectRequirement || "The technician will confirm the detailed scope during the field visit."}`);
    labeledText("Technical recommendation", input.report.recommendation.type === "CUSTOM_QUOTATION"
      ? "A custom Betech quotation will be prepared from the recorded project requirements and verified site observations."
      : `The preliminary recommendation is ${reportRecommendationLabel(input.report)}. Final suitability remains subject to technical review and site verification.`, "amber");

    addPage("Site conditions, safety & readiness");
    const genericSiteWidth = (A4[0] - MARGIN * 2 - 20) / 3;
    const genericSiteCards: Array<[string, Array<[string, string]>]> = [
      ["Site context", [["Property", clean(project.propertyType) || clean(home.type)], ["Location", input.location], ["Access", clean(site.roofAccess)]]],
      ["Existing installation", [["Existing system", clean(site.existingSystem)], ["Supply", clean(site.supplyType) || clean(electrical.grid)], ["Equipment area", clean(site.inverterLocation) || clean(site.batteryArea)]]],
      ["Site evidence", [["Captured", `${analysis.evidenceLabels.length} / 8`], ["Status", analysis.missingCriticalEvidence.length ? "VERIFICATION REQUIRED" : "AVAILABLE FOR REVIEW"], ["To confirm", analysis.missingCriticalEvidence.length ? analysis.missingCriticalEvidence.join(" · ") : "No critical evidence gaps recorded"]]],
    ];
    const genericSiteHeight = Math.max(...genericSiteCards.map(([, lines]) => cardHeight(genericSiteWidth, lines)));
    genericSiteCards.forEach(([title, lines], index) => card(MARGIN + index * (genericSiteWidth + 10), genericSiteWidth, title, lines, index === 2 && analysis.missingCriticalEvidence.length ? "amber" : "plain", genericSiteHeight));
    y -= genericSiteHeight + 11;
    section("Technical findings");
    const genericFindings = input.report.aiReview?.observations.length
      ? input.report.aiReview.observations
      : [`${projectTypeLabel} visit requested for ${visitReasonLabel.toLowerCase()}.`, "The final recommendation will use the recorded project requirements, site conditions and evidence."];
    genericFindings.slice(0, 4).forEach((finding) => labeledText("Field observation", finding));
    const outstanding = [...(input.report.aiReview?.risks || []), ...(input.report.aiReview?.dataGaps || []), ...analysis.missingCriticalEvidence];
    if (outstanding.length) {
      section("Items to confirm before quotation");
      outstanding.slice(0, 5).forEach((item) => labeledText("Technical confirmation required", item, "amber"));
    }

    addPage("Approval & next steps");
    const technicianSigned = Boolean(input.report.signatures?.technicianAccepted);
    const genericApprovalWidth = (A4[0] - MARGIN * 2 - 20) / 3;
    const genericApprovalCards: Array<[string, Array<[string, string]>, "plain" | "amber"]> = [
      ["Technician declaration", [["Status", technicianSigned ? "DIGITALLY SIGNED" : "SIGNATURE PENDING"], ["Site assessor", input.report.signatures?.technicianName || input.report.submittedByName], ["Assessment", input.visitRef]], technicianSigned ? "plain" : "amber"],
      ["Customer acknowledgement", input.report.signatures ? [["Status", "DIGITALLY ACKNOWLEDGED"], ["Customer", input.report.signatures.customerName], ["Acknowledged", issueDateTime]] : [["Status", "AWAITING CUSTOMER ACKNOWLEDGEMENT"], ["Action", "Digital acknowledgement required"]], input.report.signatures ? "plain" : "amber"],
      ["Next Betech action", [["Step 1", "Review field observations"], ["Step 2", input.report.recommendation.type === "CUSTOM_QUOTATION" ? "Prepare custom quotation" : "Confirm recommendation"], ["Step 3", "Share final quotation and schedule work"]], "plain"],
    ];
    const genericApprovalHeight = Math.max(...genericApprovalCards.map(([, lines]) => cardHeight(genericApprovalWidth, lines)));
    genericApprovalCards.forEach(([title, lines, tone], index) => card(MARGIN + index * (genericApprovalWidth + 10), genericApprovalWidth, title, lines, tone, genericApprovalHeight));
    y -= genericApprovalHeight + 11;
    labeledText("Customer note", "This report records the field assessment and preliminary recommendation. Final scope, equipment selection, price and installation schedule are confirmed in Betech's formal quotation.");
    section("Terms and contact");
    page.drawText("TECHNICAL SUPPORT", { x: MARGIN, y: y - 14, font: bold, size: 7, color: RED });
    page.drawText("0705 663 175  ·  info@betech.co.ke", { x: MARGIN, y: y - 27, font: regular, size: 8, color: INK });
    page.drawText("BETECH SOLAR SOLUTIONS", { x: MARGIN, y: y - 45, font: bold, size: 7, color: RED });
    page.drawText("www.betech.co.ke  ·  Pramukh Plaza, Nairobi CBD", { x: MARGIN, y: y - 58, font: regular, size: 8, color: INK });
    return finishDocument();
  }

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
  const adviceLoads = topLoads.filter((load) => load.energyKwh >= dailyKwh * 0.12 || load.usageMode === "ALWAYS_ON").slice(0, 3);
  if (adviceLoads.length) {
    section("Customer load advice");
    const adviceWidth = (A4[0] - MARGIN * 2 - 16) / 3;
    const adviceHeights = adviceLoads.map((load, index) => {
      const share = dailyKwh ? load.energyKwh / dailyKwh * 100 : 0;
      const type = load.usageMode === "ALWAYS_ON" ? "CONTINUOUS ESSENTIAL LOAD" : "MAJOR ENERGY CONSUMER";
      return card(MARGIN + index * (adviceWidth + 8), adviceWidth, type, [["Appliance", loadName(load)], ["Recorded use", `${formatNumber(load.energyKwh)} kWh/day · ${formatNumber(share, 0)}%`], ["Advice", load.usageMode === "ALWAYS_ON" ? "Keep on a backed-up circuit where continuity is required." : "Prefer daytime solar or grid operation; avoid unnecessary battery use."]], load.usageMode === "ALWAYS_ON" ? "plain" : "amber");
    });
    y -= Math.max(...adviceHeights) + 10;
  }

  addPage("System design & technical recommendation");
  page.drawText("Design basis is derived from the field assessment and remains subject to final installation engineering.", { x: MARGIN, y, font: regular, size: 8.5, color: MUTED });
  y -= 18;
  const designWidth = (A4[0] - MARGIN * 2 - 18) / 4;
  const inverterLines: Array<[string, string]> = [["Recorded simultaneous peak", `${formatNumber(simultaneousPeakKw)} kW`], ["Design headroom", "25% operating reserve plus motor-start allowance where recorded"], ["Recommended standard size", `${formatNumber(inverterKw, 1)} kW hybrid inverter`], ["Status", inverterKw >= analysis.inverterRequiredKw ? "SUITABLE" : "TECHNICAL REVIEW REQUIRED"]];
  const batteryLines: Array<[string, string]> = [["Backup energy", `${formatNumber(analysis.rawBackupEnergyKwh)} kWh`], ["Calculated nominal", `${formatNumber(analysis.calculatedBatteryKwh)} kWh`], ["Recommended storage", batteryKwh ? `${formatNumber(batteryKwh)} kWh lithium` : "CONFIRM LOADS"], ["Expected backup", analysis.expectedBackupHours ? `${formatNumber(analysis.expectedBackupHours, 1)} hours` : ""]];
  const pvLines: Array<[string, string]> = [["Daily energy", `${formatNumber(dailyKwh)} kWh/day`], ["Calculated PV", `${formatNumber(pvKw)} kWp`], ["Practical array", `${formatNumber(practicalPvKw)} kWp`], ["Panels", `${panelCount} × 600W`], ["Expected production", `${formatNumber(analysis.expectedSolarProductionKwh)} kWh/day`]];
  const configurationLines: Array<[string, string]> = [["Configuration", clean(electrical.grid).toLowerCase().includes("off") ? "Solar + battery" : "Hybrid — grid + solar + battery"], ["Objective", clean(electrical.systemGoal)], ["Design focus", essentialKw ? "Essential loads during outages" : "Confirm backup loads"], ["Status", analysis.technicalReviewRequired ? "TECHNICAL REVIEW REQUIRED" : "PRELIMINARY RECOMMENDATION"]];
  const systemCardHeight = Math.max(cardHeight(designWidth, inverterLines), cardHeight(designWidth, batteryLines), cardHeight(designWidth, pvLines), cardHeight(designWidth, configurationLines));
  card(MARGIN, designWidth, "Hybrid inverter", inverterLines, inverterKw >= analysis.inverterRequiredKw ? "plain" : "amber", systemCardHeight);
  card(MARGIN + designWidth + 6, designWidth, "Battery storage", batteryLines, batteryKwh && backupHours ? "plain" : "amber", systemCardHeight);
  card(MARGIN + (designWidth + 6) * 2, designWidth, "Solar PV array", pvLines, "plain", systemCardHeight);
  card(MARGIN + (designWidth + 6) * 3, designWidth, "System configuration", configurationLines, analysis.technicalReviewRequired ? "amber" : "plain", systemCardHeight);
  y -= systemCardHeight + 13;
  section("Design basis");
  const basisWidth = (A4[0] - MARGIN * 2 - 18) / 4;
  const peakSunLines: Array<[string, string]> = [["Design input", `${ASSESSMENT_DESIGN_ASSUMPTIONS.peakSunHours} h/day`], ["Purpose", "Solar resource assumption"]];
  const pvPerformanceLines: Array<[string, string]> = [["Design input", `${ASSESSMENT_DESIGN_ASSUMPTIONS.pvPerformanceFactor * 100}% factor`], ["Purpose", "Overall design factor"]];
  const batteryDesignLines: Array<[string, string]> = [["Efficiency", "92% inverter"], ["Usable DoD", "90%"], ["Reserve", "10%"]];
  const backupTargetLines: Array<[string, string]> = [["Recorded target", backupHours ? `${formatNumber(backupHours, 1)} hours` : "To be confirmed"], ["Purpose", "Customer backup requirement"]];
  const basisCardHeight = Math.max(cardHeight(basisWidth, peakSunLines), cardHeight(basisWidth, pvPerformanceLines), cardHeight(basisWidth, batteryDesignLines), cardHeight(basisWidth, backupTargetLines));
  card(MARGIN, basisWidth, "Peak sun hours", peakSunLines, "plain", basisCardHeight);
  card(MARGIN + basisWidth + 6, basisWidth, "PV performance", pvPerformanceLines, "plain", basisCardHeight);
  card(MARGIN + (basisWidth + 6) * 2, basisWidth, "Battery design", batteryDesignLines, "plain", basisCardHeight);
  card(MARGIN + (basisWidth + 6) * 3, basisWidth, "Backup target", backupTargetLines, "plain", basisCardHeight);
  y -= basisCardHeight + 9;
  labeledText("Engineering explanation", "System sizing is based on recorded simultaneous demand, essential-load backup requirements and average daily energy consumption. Battery capacity includes allowances for inverter losses, usable depth of discharge and reserve capacity. PV sizing is calculated independently and rounded upward to a practical panel configuration.");
  section("Betech technical recommendation");
  const recommendation = reportRecommendationLabel(input.report);
  const hasValidatedCatalogMatch = input.report.recommendation.type === "CATALOG_PRODUCT" && analysis.productMatch.status === "PASS";
  const recommendationText = !hasValidatedCatalogMatch
    ? "CUSTOM SYSTEM REQUIRED — The assessment requirements do not currently match a standard Betech catalogue system. A custom quotation will be prepared from this technical assessment."
    : `RECOMMENDED BETECH SYSTEM — ${recommendation}`;
  const recommendationIntro = !hasValidatedCatalogMatch
    ? "The assessment requirements do not currently match a verified standard Betech catalogue system. A custom quotation should be prepared using the specification below."
    : "The selected Betech system has been checked against the recorded preliminary design requirement.";
  const recommendationHeight = Math.max(62, 33 + splitLines(recommendationIntro, regular, 8, A4[0] - MARGIN * 2 - 30).length * 10);
  ensure(recommendationHeight + 120, "System design & technical recommendation");
  drawRoundedBox(page, { x: MARGIN, y: y - recommendationHeight, width: A4[0] - MARGIN * 2, height: recommendationHeight, color: rgb(1, 1, 1), borderColor: rgb(0.82, 0.28, 0.28), borderWidth: 0.8, borderRadius: 9 });
  page.drawText(recommendationText, { x: MARGIN + 15, y: y - 18, font: bold, size: 9.2, color: RED, maxWidth: A4[0] - MARGIN * 2 - 30 });
  drawParagraph(page, recommendationIntro, MARGIN + 15, y - 33, A4[0] - MARGIN * 2 - 30, regular, 8, INK, 10);
  y -= recommendationHeight + 8;
  const specificationWidth = (A4[0] - MARGIN * 2 - 18) / 4;
  const inverterSpecification: Array<[string, string]> = [["Required", `${formatNumber(inverterKw, 1)} kW hybrid`]];
  const batterySpecification: Array<[string, string]> = [["Required", `${formatNumber(batteryKwh)} kWh lithium`]];
  const solarArraySpecification: Array<[string, string]> = [["Practical", `${formatNumber(practicalPvKw)} kWp`]];
  const panelSpecification: Array<[string, string]> = [["Indicative", `${panelCount} × 600W`]];
  const specificationCardHeight = Math.max(
    cardHeight(specificationWidth, inverterSpecification),
    cardHeight(specificationWidth, batterySpecification),
    cardHeight(specificationWidth, solarArraySpecification),
    cardHeight(specificationWidth, panelSpecification),
  );
  card(MARGIN, specificationWidth, "Inverter", inverterSpecification, "plain", specificationCardHeight);
  card(MARGIN + specificationWidth + 6, specificationWidth, "Battery", batterySpecification, "plain", specificationCardHeight);
  card(MARGIN + (specificationWidth + 6) * 2, specificationWidth, "Solar array", solarArraySpecification, "plain", specificationCardHeight);
  card(MARGIN + (specificationWidth + 6) * 3, specificationWidth, "Panels", panelSpecification, "plain", specificationCardHeight);
  y -= specificationCardHeight + 8;
  page.drawText("FINAL EQUIPMENT NOTE: Final models, protection devices and cable sizing are confirmed in the official quotation.", { x: MARGIN, y: y - 8, font: regular, size: 6.7, color: MUTED, maxWidth: A4[0] - MARGIN * 2 });
  y -= 18;
  if (input.report.recommendation.productUrl) {
    const selectedShortName = recommendation.length > 72 ? `${recommendation.slice(0, 69)}...` : recommendation;
    const comparison = [
      ["Inverter", `${formatNumber(inverterKw, 1)} kW`, analysis.productMatch.capabilities.inverterKw ? `${formatNumber(analysis.productMatch.capabilities.inverterKw, 1)} kW` : "Not specified"],
      ["Battery", `${formatNumber(batteryKwh)} kWh`, analysis.productMatch.capabilities.batteryKwh ? `${formatNumber(analysis.productMatch.capabilities.batteryKwh)} kWh` : "Not specified"],
      ["PV array", `${formatNumber(practicalPvKw)} kWp`, analysis.productMatch.capabilities.pvKw ? `${formatNumber(analysis.productMatch.capabilities.pvKw)} kWp` : "Not specified"],
    ];
    const validationHeight = 70;
    ensure(validationHeight + 7, "System design & technical recommendation");
    drawRoundedBox(page, { x: MARGIN, y: y - validationHeight, width: A4[0] - MARGIN * 2, height: validationHeight, color: rgb(1, 0.975, 0.91), borderColor: rgb(0.94, 0.78, 0.37), borderWidth: 0.7, borderRadius: 8 });
    page.drawText("CATALOGUE PRODUCT CHECK", { x: MARGIN + 13, y: y - 16, font: bold, size: 7.5, color: AMBER });
    page.drawText(`STATUS: ${analysis.productMatch.status === "PASS" ? "SUITABLE" : "NOT SUITABLE"}`, { x: MARGIN + 268, y: y - 16, font: bold, size: 7.5, color: analysis.productMatch.status === "PASS" ? GREEN : RED });
    page.drawText(`Selected: ${selectedShortName}`, { x: MARGIN + 13, y: y - 28, font: regular, size: 6.5, color: INK, maxWidth: A4[0] - MARGIN * 2 - 26 });
    [["COMPONENT", MARGIN + 13], ["REQUIRED", MARGIN + 185], ["SELECTED", MARGIN + 295], ["STATUS", MARGIN + 425]].forEach(([label, x]) => page.drawText(String(label), { x: Number(x), y: y - 39, font: bold, size: 5.7, color: MUTED }));
    comparison.forEach(([component, required, selected], index) => {
      const rowY = y - 49 - index * 7;
      page.drawText(component, { x: MARGIN + 13, y: rowY, font: regular, size: 5.9, color: INK });
      page.drawText(required, { x: MARGIN + 185, y: rowY, font: regular, size: 5.9, color: INK });
      page.drawText(selected, { x: MARGIN + 295, y: rowY, font: regular, size: 5.9, color: INK });
      page.drawText(analysis.productMatch.status === "PASS" ? "PASS" : "FAIL", { x: MARGIN + 425, y: rowY, font: bold, size: 5.9, color: analysis.productMatch.status === "PASS" ? GREEN : RED });
    });
    y -= validationHeight + 8;
  }
  if (input.report.recommendation.tiktokUrl) labeledText("Similar Betech project", `A comparable Betech project can be viewed at ${input.report.recommendation.tiktokUrl}`);

  addPage("Site conditions, safety & readiness");
  const electricalLines: Array<[string, string]> = [["Meter", clean(electrical.billing)], ["Grid status", clean(electrical.grid)], ["Supply type", clean(site.supplyType)], ["Main breaker", clean(site.mainBreakerRating)], ["Solar breaker space", clean(site.solarBreakerSlots)]];
  const dbLines: Array<[string, string]> = [["Existing wiring", clean(electrical.wiring)], ["Earthing", clean(site.earthingCondition)], ["Earthing notes", clean(site.earthWireNotes)], ["Status", clean(site.earthingCondition).toLowerCase().includes("confirm") ? "VERIFICATION REQUIRED" : "SUITABLE FOR REVIEW"]];
  const roofLines: Array<[string, string]> = [["Roof type", clean(site.roofType)], ["Condition", clean(site.roofCondition)], ["Shading", clean(site.shading)], ["Access", clean(site.roofAccess)], ["Mounting", "Standard roof mounting"]];
  const siteRowHeight = Math.max(cardHeight(cardWidth, electricalLines), cardHeight(cardWidth, dbLines), cardHeight(cardWidth, roofLines));
  card(MARGIN, cardWidth, "Electrical supply", electricalLines, "plain", siteRowHeight);
  card(MARGIN + cardWidth + 10, cardWidth, "Earthing & DB", dbLines, clean(site.earthingCondition).toLowerCase().includes("confirm") ? "amber" : "plain", siteRowHeight);
  card(MARGIN + (cardWidth + 10) * 2, cardWidth, "Roof & mounting", roofLines, "plain", siteRowHeight);
  y -= siteRowHeight + 10;
  const secondRowWidth = cardWidth;
  const evidenceLabels = analysis.evidenceLabels;
  const equipmentLines: Array<[string, string]> = [["Inverter location", clean(site.inverterLocation)], ["Battery location", clean(site.batteryArea)], ["Cable route", clean(site.cableRoute)], ["PV to inverter", clean(site.arrayToInverter) && `${clean(site.arrayToInverter)} m`]];
  const protectionLines: Array<[string, string]> = [["Required", "PV DC isolation"], ["Required", "DC surge protection"], ["Required", "AC input/output protection"], ["Required", "Battery protection"], ["Required", "Protective earthing"]];
  const evidenceLines: Array<[string, string]> = [["Captured", `${evidenceLabels.length} / 8`], ["Status", analysis.missingCriticalEvidence.length ? "INCOMPLETE" : "COMPLETE"], ["Required", analysis.missingCriticalEvidence.length ? analysis.missingCriticalEvidence.join(" · ") : "Critical evidence recorded"]];
  const secondRowHeight = Math.max(cardHeight(secondRowWidth, equipmentLines), cardHeight(secondRowWidth, protectionLines), cardHeight(secondRowWidth, evidenceLines));
  card(MARGIN, secondRowWidth, "Equipment placement", equipmentLines, "plain", secondRowHeight);
  card(MARGIN + secondRowWidth + 10, secondRowWidth, "Electrical protection", protectionLines, "plain", secondRowHeight);
  card(MARGIN + (secondRowWidth + 10) * 2, secondRowWidth, "Site evidence", evidenceLines, analysis.missingCriticalEvidence.length ? "amber" : "plain", secondRowHeight);
  y -= secondRowHeight + 10;
  const findings = input.report.aiReview?.observations.length
    ? input.report.aiReview.observations
    : [
        `Recorded connected load is ${formatNumber(connectedKw)} kW with practical simultaneous demand of approximately ${formatNumber(simultaneousPeakKw)} kW.`,
        `Recorded use indicates approximately ${formatNumber(dailyKwh)} kWh/day of energy consumption.`,
        `${formatNumber(inverterKw, 1)} kW hybrid inverter capacity provides practical allowance for the recorded simultaneous demand.`,
        `The ${formatNumber(practicalPvKw)} kWp practical PV array is expected to produce about ${formatNumber(analysis.expectedSolarProductionKwh)} kWh/day in average conditions; actual production changes with weather, shading and season.`,
      ];
  section("Technical findings");
  const findingWidth = (A4[0] - MARGIN * 2 - 18) / 4;
  const compactFindings = [
    ["01", "LOAD DEMAND", `${formatNumber(connectedKw)} kW connected · ${formatNumber(simultaneousPeakKw)} kW simultaneous peak`],
    ["02", "DAILY ENERGY", `${formatNumber(dailyKwh)} kWh/day recorded estimate`],
    ["03", "INVERTER DESIGN", `${formatNumber(inverterKw, 1)} kW hybrid recommended`],
    ["04", "PV DESIGN", `${formatNumber(practicalPvKw)} kWp practical array · ${formatNumber(analysis.expectedSolarProductionKwh)} kWh/day expected`],
  ];
  const findingCardHeight = Math.max(...compactFindings.map(([, , detail]) => cardHeight(findingWidth, [["Finding", detail]])));
  compactFindings.forEach(([number, title, detail], index) => card(MARGIN + index * (findingWidth + 6), findingWidth, `${number} ${title}`, [["Finding", detail]], "plain", findingCardHeight));
  y -= findingCardHeight + 8;
  const outstanding = [...(input.report.aiReview?.risks || []), ...(input.report.aiReview?.dataGaps || [])];
  if (outstanding.length) {
    section("Items to confirm before quotation");
    outstanding.slice(0, 6).forEach((item) => labeledText("Technical confirmation required", item, "amber"));
  }
  section("Engineering advice");
  const relevantAdvice = analysis.loadAdvice.filter((item) => /high-heat|motor|air-conditioning|security\/connectivity|material energy/i.test(item.advice)).slice(0, 2);
  const adviceCardWidth = (A4[0] - MARGIN * 2 - 8) / 2;
  const engineeringAdviceHeight = relevantAdvice.length ? Math.max(...relevantAdvice.map((item) => cardHeight(adviceCardWidth, [["Guidance", item.advice]]))) : 0;
  relevantAdvice.forEach((item, index) => card(MARGIN + (index % 2) * (adviceCardWidth + 8), adviceCardWidth, item.name, [["Guidance", item.advice]], /motor|air-conditioning/.test(item.advice) ? "amber" : "plain", engineeringAdviceHeight));
  if (engineeringAdviceHeight) y -= engineeringAdviceHeight + 8;
  const objectiveAdvice = clean(electrical.systemGoal).toLowerCase().includes("off-grid")
    ? "Off-grid operation requires a seasonal energy review, demand control and a contingency plan before final approval. This preliminary design is not an off-grid guarantee."
    : clean(electrical.systemGoal).toLowerCase().includes("backup")
      ? "The battery design is intended for the recorded essential circuits during outages. High-heat appliances should remain on grid unless specifically designed into the backup scope."
      : "A grid-connected hybrid system is intended to reduce daytime grid energy while maintaining normal grid support when demand exceeds solar production.";
  labeledText("Design readiness", `${analysis.technicalReviewRequired ? `TECHNICAL REVIEW REQUIRED — ${analysis.technicalReviewReasons.join(" ")}` : "DESIGN READINESS — Loads, preliminary sizing and site evidence are ready for final quotation and installation design."} ${objectiveAdvice}`, analysis.technicalReviewRequired ? "amber" : "green");
  addPage("Approval & next steps");
  const technicianSigned = Boolean(input.report.signatures?.technicianAccepted);
  const approvalWidth = (A4[0] - MARGIN * 2 - 20) / 3;
  const technicianLines: Array<[string, string]> = [["Status", technicianSigned ? "DIGITALLY SIGNED" : "SIGNATURE PENDING"], ["Site assessor", input.report.signatures?.technicianName || input.report.submittedByName], ["Assessment", input.visitRef], [technicianSigned ? "Signed" : "Submitted", issueDateTime]];
  const customerApprovalLines: Array<[string, string]> = input.report.signatures ? [["Status", "DIGITALLY ACKNOWLEDGED"], ["Customer", input.report.signatures.customerName], ["Acknowledged", issueDateTime]] : [["Status", "AWAITING CUSTOMER ACKNOWLEDGEMENT"], ["Action", "Digital acknowledgement required"]];
  const reviewLines: Array<[string, string]> = [["Status", analysis.technicalReviewRequired ? "REQUIRED" : "NOT REQUIRED"], ["Reason", analysis.technicalReviewRequired ? analysis.technicalReviewReasons[0] || "Verification required" : "Preliminary technical review complete"], ["Next action", analysis.technicalReviewRequired ? "Technical review before final quotation approval" : "Proceed with final quotation review"]];
  const approvalHeight = Math.max(cardHeight(approvalWidth, technicianLines), cardHeight(approvalWidth, customerApprovalLines), cardHeight(approvalWidth, reviewLines));
  card(MARGIN, approvalWidth, "Technician declaration", technicianLines, technicianSigned ? "plain" : "amber", approvalHeight);
  card(MARGIN + approvalWidth + 10, approvalWidth, "Customer acknowledgement", customerApprovalLines, input.report.signatures ? "plain" : "amber", approvalHeight);
  card(MARGIN + (approvalWidth + 10) * 2, approvalWidth, "Technical review", reviewLines, analysis.technicalReviewRequired ? "amber" : "plain", approvalHeight);
  y -= approvalHeight + 10;
  const nextSteps = [["1", "REVIEW", "Confirm assessment details and outstanding verification."], ["2", "QUOTATION", "Prepare the final or custom quotation from the assessed requirement."], ["3", "APPROVAL", "Approve the quotation, schedule installation and complete commissioning."]];
  nextSteps.forEach(([number, title, detail], index) => {
    const x = MARGIN + index * 174;
    drawRoundedBox(page, { x, y: y - 64, width: 164, height: 64, color: PALE, borderColor: BORDER, borderWidth: 0.7, borderRadius: 8 });
    page.drawCircle({ x: x + 16, y: y - 16, size: 8, color: RED });
    page.drawText(number, { x: x + 13.8, y: y - 18.8, font: bold, size: 7, color: rgb(1, 1, 1) });
    page.drawText(title, { x: x + 30, y: y - 18, font: bold, size: 7.2, color: RED });
    drawParagraph(page, detail, x + 12, y - 34, 140, regular, 6.7, INK, 8);
  });
  y -= 78;
  labeledText("Customer note", "Actual consumption and solar production may vary with usage patterns, weather, appliance changes and site conditions.");
  section("Recent Betech solar installations");
  const projectsHeight = 92;
  ensure(projectsHeight + 8, "Approval & next steps");
  drawRoundedBox(page, { x: MARGIN, y: y - projectsHeight, width: A4[0] - MARGIN * 2, height: projectsHeight, color: PALE, borderColor: BORDER, borderWidth: 0.7, borderRadius: 8 });
  page.drawCircle({ x: MARGIN + 23, y: y - 27, size: 12, color: RED });
  page.drawText("T", { x: MARGIN + 20.5, y: y - 30, font: bold, size: 8, color: rgb(1, 1, 1) });
  page.drawText("VIEW OUR RECENT SOLAR PROJECTS", { x: MARGIN + 43, y: y - 22, font: bold, size: 8, color: RED });
  drawParagraph(page, "See real solar installations completed by Betech Solar Solutions across Kenya.", MARGIN + 43, y - 36, 285, regular, 7.5, INK, 10);
  page.drawText("@betechsolarprojects", { x: MARGIN + 43, y: y - 62, font: bold, size: 7.4, color: INK });
  page.drawText("https://www.tiktok.com/@betechsolarprojects", { x: MARGIN + 43, y: y - 74, font: regular, size: 6.8, color: RED });
  const projectsQrBytes = await QRCode.toBuffer("https://www.tiktok.com/@betechsolarprojects", { margin: 1, width: 100 }).catch(() => null);
  if (projectsQrBytes) {
    const projectsQr = await document.embedPng(projectsQrBytes);
    page.drawImage(projectsQr, { x: A4[0] - MARGIN - 72, y: y - 76, width: 58, height: 58 });
    page.drawText("SCAN TO VIEW PROJECTS", { x: A4[0] - MARGIN - 103, y: y - 87, font: bold, size: 5.6, color: MUTED });
  }
  y -= projectsHeight + 8;
  section("Terms and contact");
  const termsQr = await QRCode.toBuffer("https://www.betech.co.ke/p/terms", { margin: 1, width: 110 }).catch(() => null);
  if (termsQr) {
    const qr = await document.embedPng(termsQr);
    page.drawImage(qr, { x: MARGIN, y: y - 66, width: 54, height: 54 });
  }
  page.drawText("SCAN TO VIEW FULL TERMS", { x: MARGIN, y: y - 76, font: bold, size: 5.8, color: MUTED });
  page.drawText("www.betech.co.ke/p/terms", { x: MARGIN, y: y - 87, font: regular, size: 6.5, color: RED });
  page.drawText("TECHNICAL SUPPORT", { x: MARGIN + 175, y: y - 15, font: bold, size: 6.7, color: RED });
  page.drawText("0705 663 175", { x: MARGIN + 175, y: y - 26, font: regular, size: 7.2, color: INK });
  page.drawText("SALES DESK", { x: MARGIN + 285, y: y - 15, font: bold, size: 6.7, color: RED });
  page.drawText("0722 151 083", { x: MARGIN + 285, y: y - 26, font: regular, size: 7.2, color: INK });
  page.drawText("EMAIL", { x: MARGIN + 175, y: y - 43, font: bold, size: 6.7, color: RED });
  page.drawText("info@betech.co.ke", { x: MARGIN + 175, y: y - 54, font: regular, size: 7.2, color: INK });
  page.drawText("WEBSITE", { x: MARGIN + 285, y: y - 43, font: bold, size: 6.7, color: RED });
  page.drawText("www.betech.co.ke", { x: MARGIN + 285, y: y - 54, font: regular, size: 7.2, color: INK });
  page.drawText("OFFICE  Pramukh Plaza, 3rd Floor, Shop No. 3, Nairobi CBD", { x: MARGIN + 175, y: y - 73, font: regular, size: 6.4, color: MUTED });

  return finishDocument();
}
