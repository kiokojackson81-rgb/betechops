import {
  calculateAggregateReceiptProfit,
  readReceiptAggregatePricing,
} from "../../src/lib/receiptAggregatePricing";

describe("receipt aggregate pricing", () => {
  it("reads the authoritative total from receipt totals", () => {
    expect(
      readReceiptAggregatePricing({
        buyingTotal: 999_999,
        data: { buyingTotal: 888_888 },
        totals: { buyingTotal: 400_000, buyingPriceMode: "TOTAL" },
      }),
    ).toEqual({
      buyingTotal: 400_000,
      mode: "TOTAL",
      isAuthoritativeTotal: true,
    });
  });

  it("calculates profit from the saved aggregate total", () => {
    expect(
      calculateAggregateReceiptProfit({
        sellingTotal: 480_000,
        buyingTotal: 400_000,
        commissionTotal: 5_000,
      }),
    ).toBe(75_000);
  });

  it("does not hide a genuine loss", () => {
    expect(
      calculateAggregateReceiptProfit({
        sellingTotal: 480_000,
        buyingTotal: 500_000,
      }),
    ).toBe(-20_000);
  });
});
