import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
test("Nairobi payroll period includes midnight on the 25th and excludes midnight after the 24th", () => {
  const period = parseTradingPeriodKey("2026-08-25_2026-09-24")!;
  expect(period.start.toISOString()).toBe("2026-08-24T21:00:00.000Z");
  expect(period.end.toISOString()).toBe("2026-09-24T20:59:59.999Z");
  expect(getTradingPeriodFor(period.start).key).toBe(period.key);
  expect(getTradingPeriodFor(period.end).key).toBe(period.key);
  expect(getTradingPeriodFor(new Date(period.end.getTime() + 1)).key).toBe("2026-09-25_2026-10-24");
});
