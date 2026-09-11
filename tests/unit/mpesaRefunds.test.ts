jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/africasTalking", () => ({ sendTransactionalSms: jest.fn() }));
jest.mock("@/lib/mpesa", () => ({ getMpesaDarajaAccessToken: jest.fn(), getMpesaShortcode: jest.fn(), mpesaCallbackUrls: jest.fn() }));
jest.mock("@/lib/prisma", () => ({ prisma: { $transaction: jest.fn(), mpesaPayment: { findUnique: jest.fn() }, mpesaRefund: { findFirst: jest.fn(), aggregate: jest.fn(), create: jest.fn(), updateMany: jest.fn() }, actionLog: { create: jest.fn() }, order: { findUniqueOrThrow: jest.fn(), update: jest.fn() }, websiteOrder: { findUniqueOrThrow: jest.fn(), update: jest.fn() } } }));

import { createMpesaRefundDraft, handleMpesaRefundResult } from "@/lib/mpesaRefunds";
import { prisma } from "@/lib/prisma";

const originalPayment = {
  id: "payment-1", status: "SUCCESS", amount: 100, requestedAmount: 100, phoneNumber: "254700000000", receiptNumber: "THX123", transactionId: "THX123", orderId: "order-1", websiteOrderId: null,
  order: { id: "order-1", orderNumber: "ORD-1", totalAmount: 200, paidAmount: 100, paymentStatus: "PARTIAL" }, websiteOrder: null,
};

describe("M-Pesa refund safeguards", () => {
  beforeEach(() => jest.resetAllMocks());

  it("accepts only a partial amount within the original receipt's remaining refundable value", async () => {
    const tx = { mpesaPayment: { findUnique: jest.fn().mockResolvedValue(originalPayment) }, mpesaRefund: { findFirst: jest.fn().mockResolvedValue(null), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 40 } }), create: jest.fn().mockResolvedValue({ id: "refund-1", amount: 50, status: "DRAFT" }) }, actionLog: { create: jest.fn().mockResolvedValue({}) } };
    (prisma.$transaction as jest.Mock).mockImplementation((work) => work(tx));
    await expect(createMpesaRefundDraft({ paymentId: "payment-1", amount: 50, reason: "Customer cancellation", actorId: "admin-1" })).resolves.toMatchObject({ refundableBefore: 60 });
    await expect(createMpesaRefundDraft({ paymentId: "payment-1", amount: 61, reason: "Customer cancellation", actorId: "admin-1" })).rejects.toThrow("exceeds");
  });

  it("refuses an unsuccessful or unlinked M-Pesa ledger row", async () => {
    const tx = { mpesaPayment: { findUnique: jest.fn().mockResolvedValue({ ...originalPayment, status: "PENDING" }) } };
    (prisma.$transaction as jest.Mock).mockImplementation((work) => work(tx));
    await expect(createMpesaRefundDraft({ paymentId: "payment-1", amount: 10, reason: "Customer cancellation", actorId: "admin-1" })).rejects.toThrow("confirmed successful");
  });

  it("applies a successful Daraja reversal exactly once and reduces the linked order once", async () => {
    const refund = { id: "refund-1", status: "PROCESSING", amount: 30, originalPaymentId: "payment-1", authorizedById: "admin-1", requestedById: "admin-1", originalPayment };
    const tx = { mpesaRefund: { findFirst: jest.fn().mockResolvedValue(refund), updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }) }, order: { findUniqueOrThrow: jest.fn().mockResolvedValue(originalPayment.order), update: jest.fn().mockResolvedValue({}) }, websiteOrder: { findUniqueOrThrow: jest.fn(), update: jest.fn() }, actionLog: { create: jest.fn().mockResolvedValue({}) } };
    (prisma.$transaction as jest.Mock).mockImplementation((work) => work(tx));
    const payload = { Result: { ConversationID: "conversation-1", ResultCode: 0, ResultDesc: "The service request is processed successfully" } };
    await expect(handleMpesaRefundResult(payload)).resolves.toBe(true);
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paidAmount: 70, paymentStatus: "PARTIAL" }) }));
    tx.mpesaRefund.findFirst.mockResolvedValueOnce({ ...refund, status: "SUCCESS" });
    await expect(handleMpesaRefundResult(payload)).resolves.toBe(false);
    expect(tx.order.update).toHaveBeenCalledTimes(1);
  });

  it("does not change accounting for failed, timed-out, or unknown provider callbacks", async () => {
    const refund = { id: "refund-1", status: "PROCESSING", amount: 30, originalPaymentId: "payment-1", authorizedById: "admin-1", requestedById: "admin-1", originalPayment };
    const tx = { mpesaRefund: { findFirst: jest.fn().mockResolvedValue(refund), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, order: { update: jest.fn() }, websiteOrder: { update: jest.fn() }, actionLog: { create: jest.fn().mockResolvedValue({}) } };
    (prisma.$transaction as jest.Mock).mockImplementation((work) => work(tx));
    await expect(handleMpesaRefundResult({ Result: { ConversationID: "c", ResultCode: 17, ResultDesc: "Rejected" } })).resolves.toBe(true);
    await expect(handleMpesaRefundResult({ Result: { ConversationID: "c" } }, true)).resolves.toBe(true);
    expect(tx.order.update).not.toHaveBeenCalled();
    tx.mpesaRefund.findFirst.mockResolvedValue(null);
    await expect(handleMpesaRefundResult({ Result: { ConversationID: "unknown", ResultCode: 0 } })).resolves.toBe(false);
  });
});
