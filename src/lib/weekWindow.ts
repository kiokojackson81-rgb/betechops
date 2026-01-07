export type WeekWindow = {
  weekStart: Date;
  weekEnd: Date;
};

export function parseDateOnlyUtc(value?: string | null): Date | null {
  if (!value) return null;
  const datePart = String(value).slice(0, 10);
  const parts = datePart.split("-").map((v) => Number(v));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function mondayToSundayUtcWindow(baseDate: Date): WeekWindow {
  const anchored = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0, 0));
  const day = anchored.getUTCDay(); // 0 = Sunday, 1 = Monday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  anchored.setUTCDate(anchored.getUTCDate() + diffToMonday);
  const weekStart = new Date(anchored.getTime());
  const weekEnd = new Date(anchored.getTime());
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

const NAIROBI_TZ = "Africa/Nairobi";
const NAIROBI_OFFSET_MINUTES = 180;

// Canonical Nairobi week start (UTC) helper. Interprets any input Date as
// a UTC timestamp and returns the canonical UTC Monday midnight for the
// Nairobi-local week (UTC+3). This mirrors the canonicaliser used in
// recompute and ingestion so UI slugs/parsing are deterministic.
export function canonicalNairobiWeekStartUtc(dateUtc: Date): Date {
  const nairobiMs = dateUtc.getTime() + NAIROBI_OFFSET_MINUTES * 60_000;
  const nairobi = new Date(nairobiMs);
  const y = nairobi.getUTCFullYear();
  const m = nairobi.getUTCMonth();
  const d = nairobi.getUTCDate();
  const nairobiMidnightUtcMs = Date.UTC(y, m, d, 0, 0, 0) - NAIROBI_OFFSET_MINUTES * 60_000;
  const nairobiLocalMidnight = new Date(nairobiMidnightUtcMs + NAIROBI_OFFSET_MINUTES * 60_000);
  const day = nairobiLocalMidnight.getUTCDay();
  const deltaToMonday = (day + 6) % 7;
  const mondayUtcMs = nairobiMidnightUtcMs - deltaToMonday * 24 * 60 * 60 * 1000;
  return new Date(mondayUtcMs);
}

export function mondayToSundayNairobiWindow(baseInstant: Date): WeekWindow {
  const weekStart = canonicalNairobiWeekStartUtc(baseInstant);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return { weekStart, weekEnd };
}

export function buildUtcWeekStartIso(date: Date): string {
  return mondayToSundayNairobiWindow(date).weekStart.toISOString();
}

export function normalizeWeekStartFromParam(raw: string): Date | null {
  if (!raw) return null;
  let parsedValue = raw;
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(parsedValue);
      if (decoded === parsedValue) break;
      parsedValue = decoded;
    } catch {
      break;
    }
  }
  const parsedIso = new Date(parsedValue);
  if (!Number.isNaN(parsedIso.getTime())) {
    return canonicalNairobiWeekStartUtc(parsedIso);
  }
  const parsedDateOnly = parseDateOnlyUtc(parsedValue);
  if (parsedDateOnly) {
    return canonicalNairobiWeekStartUtc(parsedDateOnly);
  }
  return null;
}

const nairobiDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: NAIROBI_TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatNairobiDate(date: Date): string {
  return nairobiDateFormatter.format(date).replace(/,/g, "");
}
