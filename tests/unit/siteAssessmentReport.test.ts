import {
  generateSiteAssessmentReportPdf,
  parseSiteAssessmentReport,
  siteAssessmentReportSchema,
} from "@/lib/siteAssessmentReport";
import { PDFDocument } from "pdf-lib";

const reportInput = {
  assessment: {},
  aiReview: null,
  recommendation: {
    type: "CUSTOM_QUOTATION" as const,
  },
  calculation: {
    connectedKw: 1.2,
    dailyKwh: 4.5,
    inverterKw: 2,
    batteryKwh: 5.12,
    pvKw: 1.8,
    panelCount: 3,
  },
};

describe("site assessment report sign-off", () => {
  it("accepts a completed customer and technician sign-off", () => {
    expect(
      siteAssessmentReportSchema.safeParse({
        ...reportInput,
        signatures: {
          customerName: "Carolyn Jepkorir",
          customerAccepted: true,
          technicianName: "Betech Technician",
          technicianAccepted: true,
        },
      }).success,
    ).toBe(true);
  });

  it("continues to read reports issued before electronic sign-off was introduced", () => {
    expect(
      parseSiteAssessmentReport({
        ...reportInput,
        version: 1,
        submittedAt: "2026-09-12T08:00:00.000Z",
        submittedByName: "Betech Technician",
      }),
    ).not.toBeNull();
  });

  it("generates a branded PDF from structured assessment data", async () => {
    const report = parseSiteAssessmentReport({
      ...reportInput,
      assessment: {
        loads: [{ name: "Lights", qty: 10, watts: 10, usageMode: "DAILY_HOURS", hours: 5, period: "Night", essential: true }],
        home: { type: "House", bedrooms: "3", units: "1" },
        electrical: { grid: "Connected to grid", systemGoal: "Backup during outages", backupHours: "8" },
        siteDetails: { supplyType: "Single phase", roofType: "Corrugated iron", roofCondition: "Good" },
      },
      signatures: {
        customerName: "Carolyn Jepkorir",
        customerAccepted: true,
        technicianName: "Betech Technician",
        technicianAccepted: true,
      },
      version: 1,
      submittedAt: "2026-09-12T08:00:00.000Z",
      submittedByName: "Betech Technician",
    });
    expect(report).not.toBeNull();
    const pdf = await generateSiteAssessmentReportPdf({
      visitRef: "SV-2026-000002",
      customerName: "Carolyn Jepkorir",
      location: "Nairobi",
      report: report!,
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(3_000);
    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(5);
  });

  it("keeps a fuller assessment within the compact five-page layout", async () => {
    const report = parseSiteAssessmentReport({
      ...reportInput,
      assessment: {
        loads: [
          ["Lights", 10, 10, "DAILY_HOURS", 5, "Night", true], ["Lights", 3, 8, "DAILY_HOURS", 5, "Night", true],
          ["TV", 1, 90, "DAILY_HOURS", 5, "Night", true], ["Laptop", 1, 65, "DAILY_HOURS", 5, "Day", false],
          ["Microwave", 1, 1000, "EVENTS_DAILY", 0, "Day", false], ["Kettle", 1, 2000, "EVENTS_DAILY", 0, "Day", false],
          ["Cooker / oven", 1, 3500, "DAILY_HOURS", 1.5, "Night", false], ["Washing machine", 1, 700, "DAILY_HOURS", 1, "Day", false],
          ["CCTV system", 1, 60, "ALWAYS_ON", 0, "Both", true], ["Wi-Fi / fibre ONT", 1, 20, "ALWAYS_ON", 0, "Both", true],
        ].map(([name, qty, watts, usageMode, hours, period, essential]) => ({ name, qty, watts, usageMode, hours, uses: 3, minutes: 5, period, essential, simultaneous: qty })),
        electrical: { grid: "Connected to grid", systemGoal: "Backup during outages", backupHours: "8" },
        siteDetails: { supplyType: "Single phase", roofType: "Corrugated iron", roofCondition: "Good" },
        evidenceNames: { "Meter box": "meter.jpg", "Open main DB": "db.jpg", "Earthing point": "earth.jpg", "Roof wide": "roof.jpg" },
      },
      signatures: { customerName: "Carolyn Jepkorir", customerAccepted: true, technicianName: "Betech Technician", technicianAccepted: true },
      version: 1,
      submittedAt: "2026-09-12T08:00:00.000Z",
      submittedByName: "Betech Technician",
    });
    const pdf = await generateSiteAssessmentReportPdf({ visitRef: "SV-2026-000002", customerName: "Carolyn Jepkorir", location: "Nairobi", report: report! });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(5);
  });
});
