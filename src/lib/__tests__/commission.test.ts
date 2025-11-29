import { calculateCumulativeCommission } from "@/lib/commission";

test("commission ladder basic checks", () => {
  expect(calculateCumulativeCommission(900_000).commission).toBe(0);
  expect(calculateCumulativeCommission(1_000_000).commission).toBe(10_000);
  expect(calculateCumulativeCommission(2_000_000).commission).toBe(25_000);
  expect(calculateCumulativeCommission(3_000_000).commission).toBe(45_000);
});
