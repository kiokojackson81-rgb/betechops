import { getOnlineOpsWindowForTradingPeriod, getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

describe("online ops marketplace windows", () => {
  it("uses the last 4 full marketplace weeks inside the current trading period", () => {
    const period = getTradingPeriodFor(new Date("2026-04-20T06:00:00+03:00"));
    const weeks = getOnlineOpsWeeksForTradingPeriod(period, period.end, 4);
    const window = getOnlineOpsWindowForTradingPeriod(period, period.end, 4);

    expect(period.key).toBe("2026-03-25_2026-04-24");
    expect(weeks).toHaveLength(4);
    expect(weeks.map((week) => week.startInput)).toEqual([
      "2026-03-23",
      "2026-03-30",
      "2026-04-06",
      "2026-04-13",
    ]);
    expect(window.start.toISOString().slice(0, 10)).toBe("2026-03-23");
    expect(window.end.toISOString().slice(0, 10)).toBe("2026-04-19");
    expect(window.label).toBe("23 Mar 2026 – 19 Apr 2026");
  });
});
