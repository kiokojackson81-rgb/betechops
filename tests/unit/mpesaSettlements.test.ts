import {
  isSettledMpesaPayment,
  summarizeMpesaSettlements,
} from "@/lib/mpesaSettlements";

describe("M-Pesa settlement aggregation", () => {
  it("counts a C2B-owned receipt and its correlated STK confirmation once", () => {
    const summary = summarizeMpesaSettlements([
      {
        status: "SUCCESS",
        amount: 21,
        receiptNumber: "TSTRECEIPT21",
        transactionId: "TSTRECEIPT21",
      },
      // Correlated STK audit history has no receipt because the C2B row owns
      // the unique Safaricom transaction and already applied the money.
      { status: "SUCCESS", amount: 21, receiptNumber: null, transactionId: null },
    ]);

    expect(summary).toEqual({ totalReceived: 21, successfulCount: 1 });
  });

  it("does not treat an accepted or failed STK attempt as settled funds", () => {
    expect(isSettledMpesaPayment({ status: "PENDING", amount: 21, receiptNumber: null })).toBe(false);
    expect(isSettledMpesaPayment({ status: "FAILED", amount: 21, receiptNumber: "not-a-settlement" })).toBe(false);
  });

  it("defensively de-duplicates repeated copies of the same receipt", () => {
    const receipt = { status: "SUCCESS", amount: 21, receiptNumber: "TSTRECEIPT21" };
    expect(summarizeMpesaSettlements([receipt, receipt])).toEqual({ totalReceived: 21, successfulCount: 1 });
  });
});
