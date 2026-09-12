import {
  generateSiteAssessmentReportPdf,
  parseSiteAssessmentReport,
  siteAssessmentReportSchema,
} from "@/lib/siteAssessmentReport";

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
  });
});
