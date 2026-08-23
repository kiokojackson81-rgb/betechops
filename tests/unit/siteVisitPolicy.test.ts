import {
  deriveSiteVisitCreditStatus,
  getSiteVisitFeeRegion,
  getStandardSiteVisitFee,
  validateSiteVisitLifecycle,
  isAllowedSiteVisitAttachment,
} from "@/lib/siteVisitPolicy";

describe("site visit policy", () => {
  it("applies the published Nairobi and outside-Nairobi fees", () => {
    expect(getSiteVisitFeeRegion("Nairobi County")).toBe("NAIROBI");
    expect(getStandardSiteVisitFee("Nairobi")).toBe(2_000);
    expect(getStandardSiteVisitFee("Kiambu")).toBe(5_000);
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
});
