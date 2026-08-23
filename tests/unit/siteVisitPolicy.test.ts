import {
  deriveSiteVisitCreditStatus,
  getSiteVisitFeeRegion,
  getStandardSiteVisitFee,
  validateSiteVisitLifecycle,
  isAllowedSiteVisitAttachment,
  isProductLinkedSiteVisitEligible,
  calculateDataLoggerFee,
} from "@/lib/siteVisitPolicy";

describe("site visit policy", () => {
  it("applies the published three-zone site visit fees", () => {
    expect(getSiteVisitFeeRegion("Nairobi County", "Nairobi CBD")).toBe("ZONE_1");
    expect(getStandardSiteVisitFee("Nairobi")).toBe(2_000);
    expect(getStandardSiteVisitFee("Kiambu", "Thika")).toBe(2_000);
    expect(getStandardSiteVisitFee("Nakuru", "Naivasha")).toBe(5_000);
    expect(getStandardSiteVisitFee("Kisumu", "Kisumu")).toBe(10_000);
  });

  it("prevents invalid lifecycle jumps and incomplete closure", () => {
    expect(validateSiteVisitLifecycle({ previousStatus: "PENDING", status: "VISITED", outcome: null, closedReason: null })).toMatch(/cannot move/i);
    expect(validateSiteVisitLifecycle({ previousStatus: "VISITED", status: "CLOSED", outcome: null, closedReason: "" })).toMatch(/outcome/i);
    expect(validateSiteVisitLifecycle({ previousStatus: "SCHEDULED", status: "VISITED", outcome: null, closedReason: null })).toBeNull();
  });

  it("makes paid fees available once and preserves applied credit", () => {
    expect(deriveSiteVisitCreditStatus({ paymentStatus: "PAID", currentStatus: "NOT_ELIGIBLE" })).toBe("AVAILABLE");
    expect(deriveSiteVisitCreditStatus({ paymentStatus: "PAID", currentStatus: "APPLIED" })).toBe("APPLIED");
    expect(deriveSiteVisitCreditStatus({ paymentStatus: "WAIVED", currentStatus: "AVAILABLE" })).toBe("NOT_ELIGIBLE");
  });

  it("rejects oversized or executable attachment uploads", () => {
    expect(isAllowedSiteVisitAttachment({ name: "site.jpg", type: "image/jpeg", size: 200_000 })).toBeNull();
    expect(isAllowedSiteVisitAttachment({ name: "payload.exe", type: "application/octet-stream", size: 200 })).toMatch(/only/i);
    expect(isAllowedSiteVisitAttachment({ name: "large.pdf", type: "application/pdf", size: 11 * 1024 * 1024 })).toMatch(/10 MB/i);
  });

  it("enforces the exclusive product threshold and logger limits", () => {
    expect(isProductLinkedSiteVisitEligible(100_000)).toBe(false);
    expect(isProductLinkedSiteVisitEligible(100_001)).toBe(true);
    expect(calculateDataLoggerFee(false, 3)).toEqual({ days: 0, dailyRate: 5_000, fee: 0 });
    expect(calculateDataLoggerFee(true, 2)).toEqual({ days: 2, dailyRate: 5_000, fee: 10_000 });
    expect(calculateDataLoggerFee(true, 8).fee).toBe(15_000);
  });
});
