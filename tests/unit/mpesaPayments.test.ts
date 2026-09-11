jest.mock("server-only", () => ({}), { virtual: true });

jest.mock("@/lib/prisma", () => ({
  prisma: {
    websiteOrder: { findFirst: jest.fn() },
    order: { findFirst: jest.fn() },
    mpesaPayment: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { getStkPaymentStatus, handleC2bConfirmation, handleStkCallback, initiateStkPush, reconcileUnmatchedMpesaPayment } from "@/lib/mpesa";

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

  it("does not apply C2B again when an STK-success receipt already owns the physical transaction", async () => {
    (prisma.mpesaPayment.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.websiteOrder.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({ id: "order-1", orderNumber: "ORD-001", totalAmount: 100, paidAmount: 10, customerPhone: "254700000000" });
    const duplicateReceipt = Object.assign(new Error("Unique receipt"), { code: "P2002" });
    (prisma.mpesaPayment.create as jest.Mock).mockRejectedValue(duplicateReceipt);

    await handleC2bConfirmation(callbackPayload("ORD-001", "STKRECEIPT1"));

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

  it("uses the server-calculated order amount and permits a different valid M-Pesa payer number", async () => {
    const oldEnv = { ...process.env };
    process.env.MPESA_CONSUMER_KEY = "test-key";
    process.env.MPESA_CONSUMER_SECRET = "test-secret";
    process.env.MPESA_PASSKEY = "test-passkey";
    process.env.MPESA_SHORTCODE = "1231008";
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ResponseCode: "0", MerchantRequestID: "merchant-2", CheckoutRequestID: "ws_CO_456", ResponseDescription: "Accepted" }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    (prisma.websiteOrder.findFirst as jest.Mock).mockResolvedValue({ id: "web-1", orderRef: "BT-WEB-1", total: 1_570, customerPhone: "+254700000000", metadata: { amountDueNow: 21, amountPaid: 0, paymentOption: "PAY_30_PERCENT_DEPOSIT" }, status: "PENDING" });
    (prisma.mpesaPayment as unknown as { findFirst: jest.Mock }).findFirst = jest.fn().mockResolvedValue(null);
    (prisma.mpesaPayment.create as jest.Mock).mockResolvedValue({});

    await expect(initiateStkPush({ orderReference: "BT-WEB-1", phoneNumber: "0705663175" })).resolves.toMatchObject({ amount: 21, checkoutRequestId: "ws_CO_456" });
    const stkBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(stkBody).toMatchObject({ Amount: 21, PartyA: "254705663175", PartyB: "1231008", AccountReference: "BT-WEB-1" });
    process.env = oldEnv;
  });

  it("records an STK cancellation without touching the linked order", async () => {
    const pending = { ...basePayment, channel: "STK", status: "PENDING", orderId: "order-1", checkoutRequestId: "ws_CO_cancel" };
    (prisma.mpesaPayment.findUnique as jest.Mock).mockResolvedValue(pending);
    (prisma.mpesaPayment as unknown as { update: jest.Mock }).update = jest.fn().mockResolvedValue({});
    await handleStkCallback({ Body: { stkCallback: { CheckoutRequestID: "ws_CO_cancel", ResultCode: 1032, ResultDesc: "Request cancelled by user" } } });
    expect((prisma.mpesaPayment as unknown as { update: jest.Mock }).update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED" }) }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns SUCCESS to status polling when a matching C2B receipt was already applied", async () => {
    const pendingStk = {
      ...basePayment,
      channel: "STK",
      status: "PENDING",
      requestedAmount: 21,
      amount: null,
      receiptNumber: null,
      transactionId: null,
      orderId: null,
      websiteOrderId: "web-1",
      accountReference: "BT-WEB-1",
      checkoutRequestId: "ws_CO_c2b_first",
      callbackPayload: { ResponseCode: "0" },
    };
    const c2b = {
      ...basePayment,
      id: "c2b-1",
      channel: "C2B",
      status: "SUCCESS",
      amount: 21,
      websiteOrderId: "web-1",
      orderId: null,
      accountReference: "BT-WEB-1",
      receiptNumber: "C2BRECEIPT1",
      transactionId: "C2BRECEIPT1",
      // Safaricom may omit MSISDN from a C2B confirmation. The other strict
      // correlation keys still permit recovery of the STK checkout.
      phoneNumber: null,
      createdAt: new Date("2026-09-11T07:00:10.000Z"),
    };
    const successStk = {
      ...pendingStk,
      status: "SUCCESS",
      amount: 21,
      resultDescription: "Confirmed by matching C2B receipt C2BRECEIPT1",
      callbackPayload: { correlation: { receiptNumber: "C2BRECEIPT1" } },
    };
    const tx = {
      mpesaPayment: {
        findUnique: jest.fn().mockResolvedValue(pendingStk),
        findFirst: jest.fn().mockResolvedValue(c2b),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    (prisma.mpesaPayment.findUnique as jest.Mock)
      .mockResolvedValueOnce(pendingStk)
      .mockResolvedValueOnce(successStk);
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => work(tx));

    await expect(getStkPaymentStatus("ws_CO_c2b_first")).resolves.toEqual(expect.objectContaining({
      status: "SUCCESS", amount: 21, receiptNumber: "C2BRECEIPT1",
    }));
    expect(tx.mpesaPayment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: pendingStk.id, status: "PENDING" },
      data: expect.objectContaining({ status: "SUCCESS", amount: 21 }),
    }));
  });

  it("correlates a later STK callback to the already-applied C2B receipt without applying KSh twice", async () => {
    const pendingStk = {
      ...basePayment,
      channel: "STK",
      status: "PENDING",
      requestedAmount: 21,
      amount: null,
      receiptNumber: null,
      transactionId: null,
      orderId: null,
      websiteOrderId: "web-1",
      accountReference: "BT-WEB-1",
      checkoutRequestId: "ws_CO_callback_after_c2b",
      callbackPayload: { ResponseCode: "0" },
    };
    const c2b = {
      ...basePayment,
      id: "c2b-2",
      channel: "C2B",
      status: "SUCCESS",
      amount: 21,
      websiteOrderId: "web-1",
      orderId: null,
      accountReference: "BT-WEB-1",
      receiptNumber: "SAMEPHYSICAL1",
      transactionId: "SAMEPHYSICAL1",
      createdAt: new Date("2026-09-11T07:00:10.000Z"),
    };
    const tx = {
      mpesaPayment: {
        findUnique: jest.fn().mockResolvedValue(pendingStk),
        findFirst: jest.fn().mockResolvedValue(c2b),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: { update: jest.fn() },
      websiteOrder: { update: jest.fn() },
    };
    (prisma.mpesaPayment.findUnique as jest.Mock).mockResolvedValue(pendingStk);
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => work(tx));
    const callback = { Body: { stkCallback: { CheckoutRequestID: "ws_CO_callback_after_c2b", ResultCode: 0, ResultDesc: "Success", CallbackMetadata: { Item: [
      { Name: "Amount", Value: 21 }, { Name: "MpesaReceiptNumber", Value: "SAMEPHYSICAL1" }, { Name: "PhoneNumber", Value: "254700000000" }, { Name: "TransactionDate", Value: "20260911100010" },
    ] } } } };

    await handleStkCallback(callback);

    expect(tx.mpesaPayment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS", amount: 21 }) }));
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.websiteOrder.update).not.toHaveBeenCalled();
  });

  it("does not correlate a same-reference C2B payment with a different amount", async () => {
    const pendingStk = {
      ...basePayment,
      channel: "STK",
      status: "PENDING",
      requestedAmount: 21,
      amount: null,
      receiptNumber: null,
      transactionId: null,
      orderId: null,
      websiteOrderId: "web-1",
      accountReference: "BT-WEB-1",
      checkoutRequestId: "ws_CO_different_amount",
    };
    const tx = {
      mpesaPayment: {
        findUnique: jest.fn().mockResolvedValue(pendingStk),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
      },
    };
    (prisma.mpesaPayment.findUnique as jest.Mock).mockResolvedValue(pendingStk);
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => work(tx));

    await expect(getStkPaymentStatus("ws_CO_different_amount")).resolves.toEqual(expect.objectContaining({ status: "PENDING", amount: 21 }));
    expect(tx.mpesaPayment.updateMany).not.toHaveBeenCalled();
  });
});
