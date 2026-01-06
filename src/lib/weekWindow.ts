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

export function buildUtcWeekStartIso(date: Date): string {
  return mondayToSundayUtcWindow(date).weekStart.toISOString();
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
  const asDate = new Date(parsedValue);
  if (!Number.isNaN(asDate.getTime())) {
    return mondayToSundayUtcWindow(asDate).weekStart;
  }
  const parsedDateOnly = parseDateOnlyUtc(parsedValue);
  if (parsedDateOnly) {
    return mondayToSundayUtcWindow(parsedDateOnly).weekStart;
  }
  return null;
}
