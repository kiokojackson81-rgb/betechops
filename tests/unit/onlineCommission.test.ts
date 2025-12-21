import {
  computeDirectCommission,
  computeMarketplaceCommission,
  computeOnlinePeriodCommission,
  progressiveAmount,
} from "@/lib/onlineCommission";

describe("onlineCommission helpers", () => {
  test("direct fallback 5%", () => {
    expect(computeDirectCommission(80_000, 10_000).amount).toBe(500);
    expect(computeDirectCommission(300_000, 40_000).amount).toBe(2_000);
    expect(computeDirectCommission(300_000, -5_000).amount).toBe(0);
  });

  test("direct progressive band", () => {
    expect(computeDirectCommission(750_000, 0).amount).toBe(5_000);
    expect(computeDirectCommission(1_000_000, 0).amount).toBe(10_000);
  });

  test("progressiveAmount 3.2M", () => {
    expect(progressiveAmount(3_200_000)).toBe(45_000);
  });

  test("marketplace progressive no fallback", () => {
    expect(computeMarketplaceCommission(400_000).amount).toBe(0);
    expect(computeMarketplaceCommission(1_000_000).amount).toBe(10_000);
    expect(computeMarketplaceCommission(2_000_000).amount).toBe(25_000);
  });

  test("withheld marketplace", () => {
    const result = computeMarketplaceCommission(1_000_000, { grossMisconduct: true });
    expect(result.amount).toBe(0);
    expect(result.mode).toBe("withheld");
  });

  test("period aggregator sums channels", () => {
    const result = computeOnlinePeriodCommission({
      attendantId: "x",
      periodStart: new Date(),
      periodEnd: new Date(),
      directSales: 300_000,
      directProfit: 40_000,
      jumiaSales: 1_099_089,
      kilimallSales: 0,
    });

    expect(result.totalCommission).toBe(12_000);
  });
});
