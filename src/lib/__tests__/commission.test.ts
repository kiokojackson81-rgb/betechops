import { calculateCumulativeCommission } from "@/lib/commissionCommon";
import { computeMarketplaceCommission, computeOnlinePeriodCommission } from "@/lib/onlineCommission";
import { computeSalesCommissionFromTiers } from "../commission";

describe("computeSalesCommissionFromTiers - basic cases", () => {
  const tiers = [
    { minSales: 500_000, maxSales: 1_000_000, payoutFlat: 10_000 },
    { minSales: 2_000_000, maxSales: 2_000_000, payoutFlat: 15_000 },
    { minSales: 3_000_000, maxSales: 3_000_000, payoutFlat: 20_000 },
  ];

  test("below first tier uses fallback percent", () => {
    const res = computeSalesCommissionFromTiers(300_000, 40_000, tiers, 0.05);
    expect(Math.round(res)).toBe(Math.round(0.05 * 40_000));
  });

  test("inside 500k-1M band prorated", () => {
    // 750k -> progress 250k of 500k -> 0.5 * 10k = 5k
    const res = computeSalesCommissionFromTiers(750_000, 0, tiers, 0.05);
    expect(Math.round(res)).toBe(5_000);
  });

  test("exactly 1M returns full band reward", () => {
    const res = computeSalesCommissionFromTiers(1_000_000, 0, tiers, 0.05);
    expect(Math.round(res)).toBe(10_000);
  });

  test("sales between 1M and 2M keep the first tier reward", () => {
    const res = computeSalesCommissionFromTiers(1_500_000, 0, tiers, 0.05);
    expect(Math.round(res)).toBe(10_000);
  });

  test("2M includes 10k + 15k step", () => {
    const res = computeSalesCommissionFromTiers(2_000_000, 0, tiers, 0.05);
    expect(Math.round(res)).toBe(25_000);
  });

  test("adds base commission when profit exists in sales above the first tier", () => {
    const res = computeSalesCommissionFromTiers(1_500_000, 60_000, tiers, 0.05);
    const totalSalesLicense = 1_500_000;
    const baseProfitShare = Math.min(totalSalesLicense, 500_000) / totalSalesLicense;
    const baseCommission = 0.05 * 60_000 * baseProfitShare;
    const expectedProgress = 10_000; // full first band; next configured step is at 2M
    expect(res).toBeCloseTo(baseCommission + expectedProgress);
  });
});

test("commission ladder basic checks", () => {
  expect(calculateCumulativeCommission(900_000).commission).toBe(0);
  expect(calculateCumulativeCommission(1_000_000).commission).toBe(10_000);
  expect(calculateCumulativeCommission(2_000_000).commission).toBe(25_000);
  expect(calculateCumulativeCommission(3_000_000).commission).toBe(45_000);
});

test("online marketplace commission starts at 1M", () => {
  expect(computeMarketplaceCommission(686_502).amount).toBe(0);
  expect(computeMarketplaceCommission(999_999).amount).toBe(0);
  expect(computeMarketplaceCommission(1_000_000).amount).toBe(10_000);
});

test("profit-share online users keep POS and marketplace commission separate", () => {
  const result = computeOnlinePeriodCommission(
    {
      attendantId: "benjamin",
      periodStart: new Date("2026-04-25T00:00:00.000Z"),
      periodEnd: new Date("2026-05-24T23:59:59.999Z"),
      directSales: 31_500,
      directProfit: 6_110,
      jumiaSales: 686_502,
      kilimallSales: 0,
    },
    { directCommissionMode: "PROFIT_10" },
  );

  expect(result.lines.find((line) => line.channel === "DIRECT")?.commission).toBe(611);
  expect(result.lines.find((line) => line.channel === "JUMIA")?.commission).toBe(0);
  expect(result.lines.find((line) => line.channel === "KILIMALL")?.commission).toBe(0);
  expect(result.totalCommission).toBe(611);
});
