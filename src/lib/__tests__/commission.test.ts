import { calculateCumulativeCommission } from "@/lib/commissionCommon";
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
    const expectedProgress = 10_000 + 7_500; // full first band + half of 2nd band
    expect(res).toBeCloseTo(baseCommission + expectedProgress);
  });
});

test("commission ladder basic checks", () => {
  expect(calculateCumulativeCommission(900_000).commission).toBe(0);
  expect(calculateCumulativeCommission(1_000_000).commission).toBe(10_000);
  expect(calculateCumulativeCommission(2_000_000).commission).toBe(25_000);
  expect(calculateCumulativeCommission(3_000_000).commission).toBe(45_000);
});
