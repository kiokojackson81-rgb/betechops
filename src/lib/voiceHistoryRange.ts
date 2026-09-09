export const VOICE_HISTORY_RANGES = [
  "today",
  "yesterday",
  "week",
  "period",
] as const;

export type VoiceHistoryRange = (typeof VOICE_HISTORY_RANGES)[number];
export type VoiceHistoryDateRange = {
  label: string;
  start: Date;
  endExclusive: Date;
  detail?: string;
};

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
const NAIROBI_DATE_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type NairobiDateParts = { year: number; month: number; day: number };

export function normalizeVoiceHistoryRange(
  value: string | null | undefined,
): VoiceHistoryRange {
  return VOICE_HISTORY_RANGES.includes(value as VoiceHistoryRange)
    ? (value as VoiceHistoryRange)
    : "today";
}

function getNairobiDateParts(value: Date): NairobiDateParts {
  const parts = NAIROBI_DATE_PARTS.formatToParts(value);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? 0),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 0),
    day: Number(parts.find((part) => part.type === "day")?.value ?? 0),
  };
}

function shiftNairobiDate(
  parts: NairobiDateParts,
  days: number,
): NairobiDateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function nairobiCalendarDate(
  year: number,
  month: number,
  day: number,
): NairobiDateParts {
  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function startOfNairobiDay(parts: NairobiDateParts) {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day) - NAIROBI_OFFSET_MS,
  );
}

function formatNairobiDate(parts: NairobiDateParts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return date.toLocaleDateString("en-KE", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Date windows shared by the voice UI and API. These are Nairobi calendar-day
 * boundaries, regardless of the browser or server time zone.
 */
export function getVoiceHistoryDateRange(
  range: VoiceHistoryRange,
  now = new Date(),
): VoiceHistoryDateRange {
  const today = getNairobiDateParts(now);
  const todayStart = startOfNairobiDay(today);

  if (range === "today") {
    return {
      label: "Today",
      start: todayStart,
      endExclusive: startOfNairobiDay(shiftNairobiDate(today, 1)),
    };
  }

  if (range === "yesterday") {
    const yesterday = shiftNairobiDate(today, -1);
    return {
      label: "Yesterday",
      start: startOfNairobiDay(yesterday),
      endExclusive: todayStart,
    };
  }

  if (range === "week") {
    const weekday = new Date(
      Date.UTC(today.year, today.month - 1, today.day),
    ).getUTCDay();
    const monday = shiftNairobiDate(today, weekday === 0 ? -6 : 1 - weekday);
    return {
      label: "This Week",
      start: startOfNairobiDay(monday),
      endExclusive: startOfNairobiDay(shiftNairobiDate(today, 1)),
    };
  }

  const periodStart =
    today.day >= 25
      ? { year: today.year, month: today.month, day: 25 }
      : nairobiCalendarDate(today.year, today.month - 1, 25);
  const periodEnd =
    today.day >= 25
      ? nairobiCalendarDate(today.year, today.month + 1, 24)
      : { year: today.year, month: today.month, day: 24 };

  return {
    label: "Trading Period",
    start: startOfNairobiDay(periodStart),
    endExclusive: startOfNairobiDay(shiftNairobiDate(periodEnd, 1)),
    detail: `${formatNairobiDate(periodStart)} – ${formatNairobiDate(periodEnd)}`,
  };
}
