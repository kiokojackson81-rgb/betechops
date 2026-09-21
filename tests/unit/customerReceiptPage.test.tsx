jest.mock("@/lib/documentAccess", () => ({ documentAccessAllowed: jest.fn(async () => true), documentVerificationPath: () => "/verify" }));
jest.mock("@/lib/prisma", () => ({ prisma: { receipt: { findFirst: jest.fn() } } }));
jest.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
jest.mock("@/lib/reviewsReferrals", () => ({ ensureReviewInvitationForReceipt: jest.fn(), getReferralRewardPreviewForReceipt: jest.fn() }));
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/prisma";
import { ensureReviewInvitationForReceipt } from "@/lib/reviewsReferrals";
import Page from "@/app/r/[token]/view/page";

beforeEach(() => jest.clearAllMocks());
test("rejects invalid and unknown tokens before returning customer details", async () => {
  await expect(Page({ params: Promise.resolve({ token: "bad" }) })).rejects.toThrow("NOT_FOUND");
  expect(prisma.receipt.findFirst).not.toHaveBeenCalled();
  (prisma.receipt.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(Page({ params: Promise.resolve({ token: "rcpt_abcdefghijklmnop" }) })).rejects.toThrow("NOT_FOUND");
});
test("renders token-scoped view and download links even when reviews are unavailable", async () => {
  (prisma.receipt.findFirst as jest.Mock).mockResolvedValue({ id: "private-id", order: { customerName: "Example Customer", orderNumber: "Betech-123", totalAmount: 1500 } });
  (ensureReviewInvitationForReceipt as jest.Mock).mockRejectedValue(new Error("Unavailable"));
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ token: "rcpt_abcdefghijklmnop" }) }));
  expect(html).toContain('href="/r/rcpt_abcdefghijklmnop"');
  expect(html).toContain('href="/r/rcpt_abcdefghijklmnop?download=1"');
  expect(html).toContain("Example Customer");
  expect(html).not.toContain("private-id");
  expect(html).not.toContain("Refer &amp; Earn");
});
