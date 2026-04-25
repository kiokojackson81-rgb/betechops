export type TradingPeriod = {
  start: Date;
  end: Date;
  label: string;
  key: string; // ISO start_end
};

export function getJumiaWeeklyPeriodFor(date: Date): TradingPeriod {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // getDay(): Sunday=0…Saturday=6. Jumia weeks start on Monday.
  const dayOfWeek = d.getDay();
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  function toLocalIso(dt: Date) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const label = `${toLocalIso(start)} – ${toLocalIso(end)}`;
  const key = `${toLocalIso(start)}_${toLocalIso(end)}`;
  return { start, end, label, key };
}

export function getRecentJumiaWeeks(n: number): TradingPeriod[] {
  const out: TradingPeriod[] = [];
  const today = new Date();
  for (let i = 0; i < n; i += 1) {
    const ref = new Date(today);
    ref.setDate(ref.getDate() - i * 7);
    out.push(getJumiaWeeklyPeriodFor(ref));
  }
  return out;
}

export default getJumiaWeeklyPeriodFor;

const formatLabel = (date: Date) =>
  date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export function getTradingPeriodFor(date: Date): TradingPeriod {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const day = d.getDate();

  let startYear: number;
  let startMonth: number;
  let endYear: number;
  let endMonth: number;

  if (day >= 25) {
    startYear = year;
    startMonth = month;
    // next month
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear();
    endMonth = next.getMonth();
  } else {
    // current period started last month
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear();
    startMonth = prev.getMonth();
    endYear = year;
    endMonth = month;
  }

  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);

  const label = `${formatLabel(start)} – ${formatLabel(end)}`;
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}_${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

  return { start, end, label, key };
}

export function getRecentTradingPeriods(n: number): TradingPeriod[] {
  const periods: TradingPeriod[] = [];
  let cursor = getTradingPeriodFor(new Date());
  for (let i = 0; i < n; i++) {
    periods.push(cursor);
    const prevEnd = new Date(cursor.start.getTime() - 24 * 60 * 60 * 1000);
    cursor = getTradingPeriodFor(prevEnd);
  }
  return periods;
}

export function parseTradingPeriodKey(periodKey?: string): TradingPeriod | null {
  if (!periodKey) {
    return null;
  }
  const trimmed = periodKey.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split("_");
  if (parts.length !== 2) {
    return null;
  }
  const [startPart, endPart] = parts.map((part) => part.trim());
  const parseDateParts = (value: string) => {
    const segments = value.split("-");
    if (segments.length !== 3) return null;
    const year = Number(segments[0]);
    const month = Number(segments[1]);
    const day = Number(segments[2]);
    if ([year, month, day].some((n) => Number.isNaN(n))) return null;
    return { year, month, day };
  };
  const startSegments = parseDateParts(startPart);
  const endSegments = parseDateParts(endPart);
  if (!startSegments || !endSegments) {
    return null;
  }
  const start = new Date(startSegments.year, startSegments.month - 1, startSegments.day, 0, 0, 0, 0);
  const end = new Date(endSegments.year, endSegments.month - 1, endSegments.day, 23, 59, 59, 999);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  const label = `${formatLabel(start)} - ${formatLabel(end)}`;
  return { start, end, label, key: `${startPart}_${endPart}` };
}

export function getPreviousTradingPeriod(period: TradingPeriod): TradingPeriod {
  const previousDay = new Date(period.start.getTime() - 24 * 60 * 60 * 1000);
  return getTradingPeriodFor(previousDay);
}
