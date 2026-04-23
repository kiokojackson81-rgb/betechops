import {
  getCurrentNairobiWeekStartKey,
  getTodayNairobiDateKey,
  resolveDateInputKey,
  validateNotBackdatedDateInput,
  validateNotBackdatedWeekStart,
} from "@/lib/noBackdating";

describe("noBackdating", () => {
  const now = new Date("2026-04-23T09:30:00+03:00");

  test("resolves date-only inputs directly", () => {
    expect(resolveDateInputKey("2026-04-23")).toBe("2026-04-23");
  });

  test("uses Nairobi-local date for timestamps", () => {
    expect(resolveDateInputKey("2026-04-22T22:30:00Z")).toBe("2026-04-23");
  });

  test("allows today but blocks past dates", () => {
    expect(getTodayNairobiDateKey(now)).toBe("2026-04-23");
    expect(() => validateNotBackdatedDateInput("2026-04-23", "date", now)).not.toThrow();
    expect(() => validateNotBackdatedDateInput("2026-04-22", "date", now)).toThrow("date cannot be in the past");
  });

  test("allows current week start but blocks prior weeks", () => {
    expect(getCurrentNairobiWeekStartKey(now)).toBe("2026-04-20");
    expect(() => validateNotBackdatedWeekStart("2026-04-20", "weekStart", now)).not.toThrow();
    expect(() => validateNotBackdatedWeekStart("2026-04-13", "weekStart", now)).toThrow(
      "weekStart cannot be in a past week",
    );
  });
});
