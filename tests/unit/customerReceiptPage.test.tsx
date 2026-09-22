jest.mock("@/app/r/[token]/view/receipt.module.css", () => ({ __esModule: true, default: { page: "receipt-page" } }));
jest.mock("@/lib/documentAccess", () => ({ documentAccessAllowed: jest.fn(async () => true), documentVerificationPath: () => "/verify" }));
jest.mock("@/lib/prisma", () => ({ prisma: { receipt: { findFirst: jest.fn() } } }));
jest.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: () => { throw new Error("VERIFY"); } }));
jest.mock("@/lib/reviewsReferrals", () => ({ ensureReviewInvitationForReceipt: jest.fn(), getReceiptReferralOffers: jest.fn(async () => []) }));
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/prisma";
import { documentAccessAllowed } from "@/lib/documentAccess";
import { ensureReviewInvitationForReceipt, getReceiptReferralOffers } from "@/lib/reviewsReferrals";
import { customerReceiptPresentation } from "@/lib/customerReceiptPresentation";
import Page from "@/app/r/[token]/view/page";
const params = Promise.resolve({ token: "rcpt_abcdefghijklmnop" });
const fixture = (paidAmount = 1000) => ({ id: "private-id", receiptNumber: "Betech-123", data: {}, order: { customerName: "Example Customer", orderNumber: "Betech-123", totalAmount: 1000, paidAmount, items: [{ id: "item-1", sellingPrice: 1000, quantity: 1, product: { name: "Solar lamp" } }], mpesaPayments: [{ transactionAt: new Date("2026-09-21T22:30:00Z") }] } });
beforeEach(() => { jest.clearAllMocks(); (documentAccessAllowed as jest.Mock).mockResolvedValue(true); (getReceiptReferralOffers as jest.Mock).mockResolvedValue([]); (ensureReviewInvitationForReceipt as jest.Mock).mockResolvedValue({ reviewUrl: "https://www.betech.co.ke/review/rvw_example" }); });
test("rejects invalid and unknown tokens before returning customer details", async () => {
  await expect(Page({ params: Promise.resolve({ token: "bad" }) })).rejects.toThrow("NOT_FOUND");
  expect(prisma.receipt.findFirst).not.toHaveBeenCalled();
  (prisma.receipt.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(Page({ params })).rejects.toThrow("NOT_FOUND");
});
test("expired access never renders details or provisions referral invitations", async () => {
  (prisma.receipt.findFirst as jest.Mock).mockResolvedValue(fixture());
  (documentAccessAllowed as jest.Mock).mockResolvedValue(false);
  await expect(Page({ params })).rejects.toThrow("VERIFY");
  expect(ensureReviewInvitationForReceipt).not.toHaveBeenCalled();
});
test.each([[1000, "Paid in full", 0], [300, "Partially paid", 700], [0, "Awaiting payment", 1000]])("uses actual payment ledger for %s paid", async (paid, status, balance) => {
  const receipt = fixture(paid as number);
  (prisma.receipt.findFirst as jest.Mock).mockResolvedValue(receipt);
  const model = customerReceiptPresentation(receipt);
  expect(model.status).toBe(status); expect(model.balance).toBe(balance);
  const html = renderToStaticMarkup(await Page({ params }));
  expect(html).toContain(status); expect(html).toContain("Example Customer"); expect(html).toContain("Solar lamp");
  expect(html).not.toContain("Design Preview"); expect(html).not.toContain("Sample Details"); expect(html).not.toContain("private-id");
});
test("payment dates use Nairobi and missing dates are not replaced with creation dates", () => {
  expect(customerReceiptPresentation(fixture()).paymentDate).toBe("22 September 2026");
  expect(customerReceiptPresentation({ ...fixture(), order: { ...fixture().order, mpesaPayments: [] } }).paymentDate).toBe("Not recorded");
});
test("all purchase lines keep their quantities and amounts", () => {
  const receipt = fixture(300);
  receipt.order.items.push({ id: "item-2", quantity: 2, sellingPrice: 250, product: { name: "Cable" } });
  expect(customerReceiptPresentation(receipt).items.map(i => [i.name, i.quantity, i.lineTotal])).toEqual([["Solar lamp", 1, 1000], ["Cable", 2, 500]]);
});
test("preserves PDF actions and connects support, review, legal and privacy links", async () => {
  (prisma.receipt.findFirst as jest.Mock).mockResolvedValue(fixture());
  const html = renderToStaticMarkup(await Page({ params }));
  for (const href of ["/r/rcpt_abcdefghijklmnop", "/r/rcpt_abcdefghijklmnop?download=1", "https://wa.me/254722151083", "tel:+254722151083", "https://www.betech.co.ke/support/report-issue", "https://www.betech.co.ke/review/rvw_example", "https://www.betech.co.ke/p/terms", "https://www.betech.co.ke/privacy"]) expect(html).toContain(`href="${href}"`);
  expect(html).toContain("Keep your receipt link private.");
});
test("one referral card shows each item’s full-price reward even for partial payment", async () => {
  (prisma.receipt.findFirst as jest.Mock).mockResolvedValue(fixture(300));
  (getReceiptReferralOffers as jest.Mock).mockResolvedValue([1000, 250].map((price, i) => ({ productId: `p${i}`, productName: `Item ${i}`, purchasePrice: price, reward: price * .06, commissionType: "PERCENTAGE", commissionRate: 6, requiresFullPayment: true, holdingDays: 7, trackingDays: 90 })));
  const html = renderToStaticMarkup(await Page({ params }));
  expect(html.match(/id="receipt-referral-heading"/g)).toHaveLength(1);
  expect(html).toContain("KSh 60.00"); expect(html).toContain("KSh 15.00"); expect(html).toContain("6% of this item’s KSh 1,000.00 purchase price.");
  expect(html).toContain("Get Referral Link"); expect(html).not.toContain("Start your referral");
});
test("PDF remains available if review service fails", async () => {
  (prisma.receipt.findFirst as jest.Mock).mockResolvedValue(fixture());
  (ensureReviewInvitationForReceipt as jest.Mock).mockRejectedValue(new Error("Unavailable"));
  const html = renderToStaticMarkup(await Page({ params }));
  expect(html).toContain('href="/r/rcpt_abcdefghijklmnop?download=1"'); expect(html).toContain("Reviews are temporarily unavailable");
});
