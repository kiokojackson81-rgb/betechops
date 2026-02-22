import { canonicalNairobiWeekStartUtc, formatNairobiDate, mondayToSundayNairobiWindow } from "@/lib/weekWindow";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NAIROBI_WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Nairobi", weekday: "short" });

const nairobiWeekdayIndex = (date: Date) => {
  const key = NAIROBI_WEEKDAY.format(date).toLowerCase();
  if (key.startsWith("sun")) return 0;
  if (key.startsWith("mon")) return 1;
  if (key.startsWith("tue")) return 2;
  if (key.startsWith("wed")) return 3;
  if (key.startsWith("thu")) return 4;
  if (key.startsWith("fri")) return 5;
  if (key.startsWith("sat")) return 6;
  return 0;
};

export type OnlineOpsWeekCard = {
  weekStart: Date;
  weekEndExclusive: Date;
  weekEndInclusive: Date;
  startInput: string; // YYYY-MM-DD
  label: string; // "26 Jan 2026 – 01 Feb 2026"
  key: string;
};

export function getOnlineOpsWeeksForTradingPeriod(
  period: { start: Date; end: Date },
  reference: Date = new Date(),
  count = 4,
): OnlineOpsWeekCard[] {
  const anchor = new Date(Math.min(period.end.getTime(), reference.getTime()));

  // Build all Sundays that fall within this trading period (Nairobi-local).
  const sundays: Date[] = [];
  const startCursor = new Date(period.start);
  const deltaToSunday = (7 - nairobiWeekdayIndex(startCursor)) % 7;
  const firstSunday = new Date(startCursor.getTime() + deltaToSunday * MS_PER_DAY);
  for (
    let cursor = firstSunday;
    cursor.getTime() <= period.end.getTime();
    cursor = new Date(cursor.getTime() + 7 * MS_PER_DAY)
  ) {
    sundays.push(cursor);
  }

  if (sundays.length === 0) {
    const fallbackStart = canonicalNairobiWeekStartUtc(anchor);
    const window = mondayToSundayNairobiWindow(fallbackStart);
    const endInclusive = new Date(window.weekEnd.getTime() - MS_PER_DAY);
    return [
      {
        weekStart: window.weekStart,
        weekEndExclusive: window.weekEnd,
        weekEndInclusive: endInclusive,
        startInput: window.weekStart.toISOString().slice(0, 10),
        label: `${formatNairobiDate(window.weekStart)} – ${formatNairobiDate(endInclusive)}`,
        key: window.weekStart.toISOString(),
      },
    ];
  }

  let lastIndex = -1;
  for (let i = 0; i < sundays.length; i += 1) {
    if (sundays[i]!.getTime() <= anchor.getTime()) lastIndex = i;
  }
  if (lastIndex < 0) lastIndex = 0;

  const startIndex = lastIndex >= count - 1 ? lastIndex - (count - 1) : 0;
  const slice = sundays.slice(startIndex, startIndex + count);
  const padded = slice.length < count ? [...slice, ...sundays.slice(startIndex + slice.length, startIndex + count)] : slice;

  return padded.slice(0, count).map((sunday) => {
    const weekStart = canonicalNairobiWeekStartUtc(sunday);
    const window = mondayToSundayNairobiWindow(weekStart);
    const endInclusive = new Date(window.weekEnd.getTime() - MS_PER_DAY);
    return {
      weekStart: window.weekStart,
      weekEndExclusive: window.weekEnd,
      weekEndInclusive: endInclusive,
      startInput: window.weekStart.toISOString().slice(0, 10),
      label: `${formatNairobiDate(window.weekStart)} – ${formatNairobiDate(endInclusive)}`,
      key: window.weekStart.toISOString(),
    };
  });
}

