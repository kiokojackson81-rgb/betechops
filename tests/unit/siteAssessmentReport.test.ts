import { parseSiteAssessmentReport, siteAssessmentReportSchema } from "@/lib/siteAssessmentReport";

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
});
