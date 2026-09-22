jest.mock("@/lib/prisma", () => ({ prisma: { receipt: { findFirst: jest.fn(async () => ({ id: "receipt-1" })) } } }));
jest.mock("@/lib/documentAccess", () => ({ documentAccessAllowed: jest.fn(async () => true), documentVerificationPath: () => "/documents/receipt/token/verify" }));
jest.mock("@/lib/reviewsReferrals", () => ({
  createReferralSchema: { parse: (value: unknown) => value },
  ensureReviewInvitationForReceipt: jest.fn(async () => ({ reviewUrl: "https://www.betech.co.ke/review/review-token" })),
  createReferralFromReview: jest.fn(async () => ({ referralUrl: "https://www.betech.co.ke/shop/product/lamp?ref=separate-code", activationUrl: "https://agents.betech.co.ke/activate?token=activation-token", activationToken: "not-exposed" })),
}));
import { POST } from "@/app/api/receipts/public/[token]/referral/route";
import { documentAccessAllowed } from "@/lib/documentAccess";
import { createReferralFromReview } from "@/lib/reviewsReferrals";
const context = { params: Promise.resolve({ token: "rcpt_abcdefghijklmnop" }) };
const request = () => new Request("http://localhost/api/receipts/public/token/referral", { method: "POST", body: JSON.stringify({ productId: "product-2", referredPhone: "0712345678", referredName: "Friend", reward: 999999 }) });
beforeEach(() => { jest.clearAllMocks(); (documentAccessAllowed as jest.Mock).mockResolvedValue(true); });
test("referral action rechecks expired receipt access", async () => {
  (documentAccessAllowed as jest.Mock).mockResolvedValue(false);
  const response = await POST(request(), context);
  expect(response.status).toBe(401); expect(await response.json()).toHaveProperty("verificationUrl");
  expect(createReferralFromReview).not.toHaveBeenCalled();
});
test("uses server-owned receipt and reward context and returns only separate links", async () => {
  const response = await POST(request(), context);
  expect(response.status).toBe(200);
  expect(createReferralFromReview).toHaveBeenCalledWith({ token: "review-token", referredPhone: "0712345678", referredName: "Friend", channel: "copy" }, { receiptId: "receipt-1", productId: "product-2" });
  const body = await response.text();
  expect(body).toContain("ref=separate-code"); expect(body).not.toContain("rcpt_"); expect(body).not.toContain("not-exposed");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
