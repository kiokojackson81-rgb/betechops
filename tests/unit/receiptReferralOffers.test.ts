jest.mock("@/lib/prisma", () => ({ prisma: { receipt: { findUnique: jest.fn() }, product: { findUnique: jest.fn() }, $queryRawUnsafe: jest.fn(), $executeRawUnsafe: jest.fn(), $transaction: jest.fn() } }));
jest.mock("@/lib/referralFraud", () => ({ ensureReferralFraudSchema: jest.fn(), assertNoSelfReferralForReview: jest.fn(), claimReferralOwnershipLock: jest.fn(async () => ({ id: "lock" })) }));
import { prisma } from "@/lib/prisma";
import { getReceiptReferralOffers, createReferralFromReview } from "@/lib/reviewsReferrals";
import { assertNoSelfReferralForReview, claimReferralOwnershipLock } from "@/lib/referralFraud";
const policy = { enabled: true, commissionType: "PERCENTAGE", commissionRate: 6, requiresFullPayment: true, holdingDays: 7 };
const item = (id: string, price: number) => ({ id: `item-${id}`, productId: id, sellingPrice: price, quantity: 2, product: { name: `Product ${id}` } });
beforeEach(() => {
  jest.clearAllMocks();
  (prisma.receipt.findUnique as jest.Mock).mockResolvedValue({ id: "r1", order: { paidAmount: 300, items: [item("p1", 1000), item("p2", 250)] } });
  (prisma.product.findUnique as jest.Mock).mockImplementation(async ({ where }) => ({ id: where.id, name: `Product ${where.id}`, sellingPrice: 9000, commissionEnabled: false, commissionAmount: null }));
  (prisma.$queryRawUnsafe as jest.Mock).mockImplementation(async (sql: string) => sql.includes('FROM "ProductReferralPolicy"') ? [policy] : sql.includes('FROM "ReviewInvitation"') ? [{ id: "inv1", productId: "p1", receiptId: "r1", customerName: "Buyer", customerPhone: "0722123456" }] : []);
  (prisma.$transaction as jest.Mock).mockImplementation(async fn => fn(prisma));
});
test("multiple items use full unit purchase prices, never deposits or updated catalogue prices", async () => {
  const offers = await getReceiptReferralOffers("r1");
  expect(offers.map(o => [o.productId, o.purchasePrice, o.reward])).toEqual([["p1", 1000, 60], ["p2", 250, 15]]);
  expect(offers[0]).toMatchObject({ trackingDays: 90, requiresFullPayment: true, holdingDays: 7 });
});
test("disabled items and minimum purchase rules are honored", async () => {
  (prisma.$queryRawUnsafe as jest.Mock).mockImplementation(async (_sql, id) => [{ ...policy, enabled: id !== "p1", minimumQualifyingSale: 500 }]);
  expect(await getReceiptReferralOffers("r1")).toEqual([]);
});
test("custom fixed rewards and caps are preserved", async () => {
  (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([{ ...policy, commissionType: "FIXED", fixedAmount: 100, maximumAmount: 45 }]);
  expect((await getReceiptReferralOffers("r1"))[0]).toMatchObject({ commissionType: "FIXED", reward: 45, maximumAmount: 45 });
});
test("selected item is validated against the receipt before referral creation", async () => {
  await expect(createReferralFromReview({ token: "review-token", referredPhone: "0712345678", channel: "copy" }, { receiptId: "r1", productId: "unowned" })).rejects.toThrow("not eligible");
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test("invitation cannot be used for another receipt", async () => {
  await expect(createReferralFromReview({ token: "review-token", referredPhone: "0712345678", channel: "copy" }, { receiptId: "other", productId: "p1" })).rejects.toThrow("does not belong");
});
test("selected secondary item creates a separate tracked link with fraud and ownership checks", async () => {
  const referral = await createReferralFromReview({ token: "review-token", referredPhone: "0712345678", channel: "copy" }, { receiptId: "r1", productId: "p2" });
  expect(referral.product.id).toBe("p2"); expect(referral.potentialCommission).toBe(15);
  expect(referral.referralUrl).toContain("?ref="); expect(referral.referralUrl).not.toContain("rcpt_");
  expect(assertNoSelfReferralForReview).toHaveBeenCalled(); expect(claimReferralOwnershipLock).toHaveBeenCalled();
  const insert = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.find(call => call[0].includes('INSERT INTO "ReferralLink"'));
  expect(insert).toBeDefined(); expect(insert!.some(value => typeof value === "string" && value.includes('"saleAmount":250'))).toBe(true);
});
