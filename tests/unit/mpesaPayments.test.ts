jest.mock("server-only", () => ({}), { virtual: true });

jest.mock("@/lib/prisma", () => ({
  prisma: {
    websiteOrder: { findFirst: jest.fn() },
    order: { findFirst: jest.fn() },
    mpesaPayment: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { handleC2bConfirmation, handleStkCallback, reconcileUnmatchedMpesaPayment } from "@/lib/mpesa";

const transactionId = "TESTMPESA001";
const basePayment = {
  id: "payment-1",
  channel: "C2B",
  status: "UNMATCHED",
  orderId: null,
  websiteOrderId: null,
  accountReference: "TEST001",
  requestedAmount: null,
  amount: 10,
  phoneNumber: "254700000000",
  merchantRequestId: null,
  checkoutRequestId: null,
  receiptNumber: transactionId,
  transactionId,
  resultCode: 0,
  resultDescription: "Could not match BillRefNumber to a Betech order or invoice",
  transactionAt: new Date("2026-09-11T07:00:00.000Z"),
  callbackPayload: { TransID: transactionId, BillRefNumber: "TEST001", TransAmount: 10 },
  createdAt: new Date("2026-09-11T07:00:00.000Z"),
  updatedAt: new Date("2026-09-11T07:00:00.000Z"),
};

function callbackPayload(reference: string, transId = transactionId) {
  return {
    TransID: transId,
    BillRefNumber: reference,
    TransAmount: "10",
    TransTime: "20260911100000",
    MSISDN: "254700000000",
    BusinessShortCode: "1231008",
  };
}

describe("M-Pesa C2B ledger and reconciliation", () => {
  beforeEach(() => jest.resetAllMocks());

  it("automatically matches a known C2B reference and applies the payment once", async () => {
    const pendingPayment = { ...basePayment, status: "PENDING", orderId: "order-1", accountReference: "ORD-001" };
    const tx = {
      mpesaPayment: { findUnique: jest.fn().mockResolvedValue(pendingPayment), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({}) },
      order: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "order-1", totalAmount: 100, paidAmount: 20, status: "PENDING" }),
        update: jest.fn().mockResolvedValue({}),
      },
      websiteOrder: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    };
    (prisma.mpesaPayment.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.websiteOrder.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({ id: "order-1", orderNumber: "ORD-001", totalAmount: 100, paidAmount: 20, customerPhone: "254700000000" });
    (prisma.mpesaPayment.create as jest.Mock).mockResolvedValue(pendingPayment);
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => work(tx));

    await handleC2bConfirmation(callbackPayload("ORD-001"));

    expect(prisma.mpesaPayment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", orderId: "order-1", transactionId }) }));
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paidAmount: 30, paymentStatus: "PARTIAL" }) }));
    expect(tx.mpesaPayment.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS", amount: 10 }) }));
  });

  it("records an unknown C2B reference as UNMATCHED without applying it", async () => {
    (prisma.mpesaPayment.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.websiteOrder.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.mpesaPayment.create as jest.Mock).mockResolvedValue(basePayment);

    await handleC2bConfirmation(callbackPayload("TEST001"));

    expect(prisma.mpesaPayment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "UNMATCHED", accountReference: "TEST001", transactionId }) }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not create a second ledger payment for a duplicate Safaricom TransID", async () => {
    (prisma.mpesaPayment.findUnique as jest.Mock).mockResolvedValue(basePayment);

    await handleC2bConfirmation(callbackPayload("TEST001"));

    expect(prisma.mpesaPayment.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reconciles an unmatched payment atomically and supports partial payment", async () => {
    const tx = {
      mpesaPayment: {
        findUnique: jest.fn().mockResolvedValue(basePayment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({ id: "order-1", orderNumber: "ORD-001", totalAmount: 100, paidAmount: 20, customerPhone: "254700000000", status: "PENDING" }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "order-1", totalAmount: 100, paidAmount: 20, status: "PENDING" }),
        update: jest.fn().mockResolvedValue({}),
      },
      websiteOrder: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
      actionLog: { create: jest.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => work(tx));

    const result = await reconcileUnmatchedMpesaPayment({ paymentId: "payment-1", target: { kind: "ORDER", id: "order-1" }, actorId: "admin-1" });

    expect(tx.mpesaPayment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "payment-1", status: "UNMATCHED" } }));
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paidAmount: 30, paymentStatus: "PARTIAL" }) }));
    expect(tx.actionLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: "admin-1", action: "RECONCILE_UNMATCHED_C2B" }) }));
    expect(result).toEqual(expect.objectContaining({ paidBefore: 20, paidAfter: 30, balance: 70 }));
  });

  it("marks a selected order paid when manual reconciliation clears its remaining balance", async () => {
    const tx = {
      mpesaPayment: {
        findUnique: jest.fn().mockResolvedValue(basePayment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({ id: "order-1", orderNumber: "ORD-001", totalAmount: 30, paidAmount: 20, customerPhone: "254700000000", status: "PENDING" }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "order-1", totalAmount: 30, paidAmount: 20, status: "PENDING" }),
        update: jest.fn().mockResolvedValue({}),
      },
      websiteOrder: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
      actionLog: { create: jest.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => work(tx));

    const result = await reconcileUnmatchedMpesaPayment({ paymentId: "payment-1", target: { kind: "ORDER", id: "order-1" }, actorId: "admin-1" });

    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paidAmount: 30, paymentStatus: "PAID", status: "PROCESSING" }) }));
    expect(result).toEqual(expect.objectContaining({ paidAfter: 30, balance: 0 }));
  });

  it("rejects a duplicate reconciliation attempt before it can modify an order", async () => {
    const tx = {
      mpesaPayment: {
        findUnique: jest.fn().mockResolvedValue(basePayment),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({ id: "order-1", orderNumber: "ORD-001", totalAmount: 100, paidAmount: 20, customerPhone: "254700000000", status: "PENDING" }),
        findUniqueOrThrow: jest.fn(),
      },
      websiteOrder: { findUnique: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => work(tx));

    await expect(reconcileUnmatchedMpesaPayment({ paymentId: "payment-1", target: { kind: "ORDER", id: "order-1" }, actorId: "admin-1" }))
      .rejects.toThrow("already been reconciled");
    expect(tx.order.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("applies a successful STK callback once and ignores a duplicate callback", async () => {
    const pending = { ...basePayment, channel: "STK", status: "PENDING", orderId: "order-1", checkoutRequestId: "ws_CO_123" };
    const tx = {
      mpesaPayment: { updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }), findUnique: jest.fn().mockResolvedValue(pending), update: jest.fn().mockResolvedValue({}) },
      order: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "order-1", totalAmount: 100, paidAmount: 0, status: "PENDING" }), update: jest.fn().mockResolvedValue({}) },
      websiteOrder: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    };
    (prisma.mpesaPayment.findUnique as jest.Mock).mockResolvedValue(pending);
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => work(tx));
    const callback = { Body: { stkCallback: { CheckoutRequestID: "ws_CO_123", MerchantRequestID: "merchant-1", ResultCode: 0, ResultDesc: "Success", CallbackMetadata: { Item: [
      { Name: "Amount", Value: 10 }, { Name: "MpesaReceiptNumber", Value: "TST123ABC4" }, { Name: "PhoneNumber", Value: "254700000000" }, { Name: "TransactionDate", Value: "20260911100000" },
    ] } } } };

    await handleStkCallback(callback);
    await handleStkCallback(callback);

    expect(tx.order.update).toHaveBeenCalledTimes(1);
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paidAmount: 10 }) }));
  });
});
