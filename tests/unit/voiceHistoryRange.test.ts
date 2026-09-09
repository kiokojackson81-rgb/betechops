import {
  getVoiceHistoryDateRange,
  normalizeVoiceHistoryRange,
} from "@/lib/voiceHistoryRange";

describe("voice history ranges", () => {
  const now = new Date("2026-09-09T16:15:00.000Z"); // 19:15 in Nairobi

  it("uses the complete previous Nairobi calendar day for yesterday", () => {
    const range = getVoiceHistoryDateRange("yesterday", now);

    expect(range.start.toISOString()).toBe("2026-09-07T21:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-09-08T21:00:00.000Z");
  });

  it("returns Monday through the end of today for this week", () => {
    const range = getVoiceHistoryDateRange("week", now);

    expect(range.start.toISOString()).toBe("2026-09-06T21:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-09-09T21:00:00.000Z");
  });

  it("uses the Nairobi 25th-to-24th trading period", () => {
    const range = getVoiceHistoryDateRange("period", now);

    expect(range.start.toISOString()).toBe("2026-08-24T21:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-09-24T21:00:00.000Z");
  });

  it("falls back to today for an unrecognised range", () => {
    expect(normalizeVoiceHistoryRange("last-month")).toBe("today");
  });
});
