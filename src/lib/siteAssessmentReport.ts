import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";

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
  version: 1;
  submittedAt: string;
  submittedByName: string;
};

export function parseSiteAssessmentReport(value: unknown): SiteAssessmentReport | null {
  const parsed = siteAssessmentReportSchema.extend({
    version: z.literal(1),
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

function wrapLine(value: string, maxLength = 88) {
  const words = String(value || "").replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line || `${line} ${word}`.length <= maxLength) {
      line = line ? `${line} ${word}` : word;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
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
  let page = document.addPage([595.28, 841.89]);
  let y = 794;
  const margin = 46;
  const lineHeight = 15;

  const newPage = () => {
    page = document.addPage([595.28, 841.89]);
    y = 794;
  };
  const draw = (value: string, options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const size = options.size || 10;
    for (const line of wrapLine(value, options.size && options.size >= 16 ? 48 : 88)) {
      if (y < 58) newPage();
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: options.bold ? bold : regular,
        color: options.color || rgb(0.08, 0.12, 0.2),
        maxWidth: 505,
      });
      y -= lineHeight + (size > 14 ? 5 : 0);
    }
  };
  const section = (title: string) => {
    y -= 8;
    draw(title.toUpperCase(), { bold: true, size: 10, color: rgb(0.48, 0, 0) });
    y -= 3;
  };

  draw("BETECH SOLAR SOLUTIONS", { bold: true, size: 12, color: rgb(0.48, 0, 0) });
  draw("Site Assessment Report", { bold: true, size: 21 });
  y -= 4;
  draw(`Reference: ${input.visitRef}`);
  draw(`Customer: ${input.customerName}`);
  draw(`Site: ${input.location || "Recorded in BetechOps"}`);
  draw(`Issued: ${new Date(input.report.submittedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}`);
  section("Assessment summary");
  draw(input.report.aiReview?.summary || "A field assessment was completed. Final system scope remains subject to site verification and quotation.");
  section("Preliminary system sizing");
  draw(`Connected load: ${input.report.calculation.connectedKw.toFixed(2)} kW · Daily energy: ${input.report.calculation.dailyKwh.toFixed(2)} kWh`);
  draw(`Indicative inverter: ${input.report.calculation.inverterKw.toFixed(1)} kW · Lithium storage: ${input.report.calculation.batteryKwh.toFixed(2)} kWh`);
  draw(`Indicative PV array: ${input.report.calculation.pvKw.toFixed(2)} kWp · About ${input.report.calculation.panelCount} panels`);
  section("Betech recommendation");
  draw(reportRecommendationLabel(input.report), { bold: true });
  if (input.report.recommendation.notes) draw(input.report.recommendation.notes);
  if (input.report.recommendation.tiktokUrl) draw(`Similar Betech project: ${input.report.recommendation.tiktokUrl}`);
  const review = input.report.aiReview;
  if (review?.recommendations.length) {
    section("Recommended next actions");
    review.recommendations.forEach((item) => draw(`• ${item}`));
  }
  if (review?.risks.length || review?.dataGaps.length) {
    section("Items to confirm before quotation");
    [...(review.risks || []), ...(review.dataGaps || [])].forEach((item) => draw(`• ${item}`));
  }
  if (input.report.signatures) {
    section("Customer and technician sign-off");
    draw(`Customer / authorised representative: ${input.report.signatures.customerName}`);
    draw(`Betech technician: ${input.report.signatures.technicianName}`);
    draw(`Electronic acknowledgements recorded when this report was submitted on ${new Date(input.report.submittedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}.`);
  }
  y -= 8;
  draw("This report is a field-planning recommendation. Final electrical design, stock confirmation and installation scope are confirmed in the official quotation.", { size: 9, color: rgb(0.3, 0.35, 0.45) });
  return Buffer.from(await document.save());
}
