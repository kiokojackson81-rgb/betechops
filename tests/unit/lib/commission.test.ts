import { calculateCumulativeCommission } from "@/lib/commission";

describe("calculateCumulativeCommission", () => {
  test("returns 0 for below first threshold", () => {
    expect(calculateCumulativeCommission(900_000).commission).toBe(0);
  });

  test("1,000,000 -> 10,000", () => {
    expect(calculateCumulativeCommission(1_000_000).commission).toBe(10_000);
  });

  test("2,000,000 -> 25,000", () => {
    expect(calculateCumulativeCommission(2_000_000).commission).toBe(25_000);
  });

  test("3,000,000 -> 45,000", () => {
    expect(calculateCumulativeCommission(3_000_000).commission).toBe(45_000);
  });
});
