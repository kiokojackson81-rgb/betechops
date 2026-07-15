import {
  buildReviewInvitationOutboundMessage,
  calculateReferralCommission,
  getReviewInvitationExpiry,
  getReviewSendDate,
  hashPublicToken,
} from "@/lib/reviewsReferrals";

describe("reviewsReferrals", () => {
  it("hashes tokens deterministically", () => {
    expect(hashPublicToken("rvw_abc123")).toBe(hashPublicToken("rvw_abc123"));
    expect(hashPublicToken("rvw_abc123")).not.toBe(hashPublicToken("rvw_xyz987"));
  });

  it("computes 7-day send date", () => {
    const purchaseDate = new Date("2026-07-15T00:00:00.000Z");
    expect(getReviewSendDate(purchaseDate).toISOString()).toBe("2026-07-22T00:00:00.000Z");
  });

  it("computes 90-day expiry date", () => {
    const purchaseDate = new Date("2026-07-15T00:00:00.000Z");
    expect(getReviewInvitationExpiry(purchaseDate).toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });

  it("builds a customer-facing review invitation message", () => {
    expect(
      buildReviewInvitationOutboundMessage({
        customerName: "Jane Wanjiku",
        productName: "5KW Hybrid Inverter",
        reviewUrl: "https://www.betech.co.ke/review/rvw_demo",
      }),
    ).toContain("Hello Jane");
    expect(
      buildReviewInvitationOutboundMessage({
        customerName: "Jane Wanjiku",
        productName: "5KW Hybrid Inverter",
        reviewUrl: "https://www.betech.co.ke/review/rvw_demo",
      }),
    ).toContain("https://www.betech.co.ke/review/rvw_demo");
  });

  it("computes percentage commissions", () => {
    expect(
      calculateReferralCommission(125000, {
        commissionType: "PERCENTAGE",
        commissionRate: 6,
        fixedAmount: null,
        maximumAmount: null,
        minimumQualifyingSale: null,
      }),
    ).toBe(7500);
  });

  it("computes fixed commissions with caps and minimums", () => {
    expect(
      calculateReferralCommission(14000, {
        commissionType: "FIXED",
        commissionRate: null,
        fixedAmount: 1000,
        maximumAmount: 800,
        minimumQualifyingSale: 10000,
      }),
    ).toBe(800);

    expect(
      calculateReferralCommission(9000, {
        commissionType: "FIXED",
        commissionRate: null,
        fixedAmount: 1000,
        maximumAmount: null,
        minimumQualifyingSale: 10000,
      }),
    ).toBe(0);
  });
});
