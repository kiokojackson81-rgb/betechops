import { canonicalNairobiWeekStartUtc } from "@/lib/weekWindow";

const NAIROBI_TZ = "Africa/Nairobi";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const NAIROBI_DATE_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: NAIROBI_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getNairobiDateParts(date: Date) {
  const parts = NAIROBI_DATE_PARTS.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "");
  return { year, month, day };
}

export function getNairobiDateKey(date: Date): string {
  const { year, month, day } = getNairobiDateParts(date);
  return formatDateKey(year, month, day);
}

export function getTodayNairobiDateKey(now: Date = new Date()): string {
  return getNairobiDateKey(now);
}

export function getCurrentNairobiWeekStartKey(now: Date = new Date()): string {
  return getNairobiDateKey(canonicalNairobiWeekStartUtc(now));
}

export function resolveDateInputKey(input: string | Date): string | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : getNairobiDateKey(input);
  }
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  if (DATE_ONLY_RE.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return getNairobiDateKey(parsed);
}

export function parseDateInput(input: string | Date): Date | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : new Date(input);
  }
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateNotBackdatedDateInput(input: string | Date, fieldLabel = "date", now: Date = new Date()) {
  const parsed = parseDateInput(input);
  const inputKey = resolveDateInputKey(input);
  if (!parsed || !inputKey) {
    throw new Error(`Invalid ${fieldLabel}`);
  }
  const todayKey = getTodayNairobiDateKey(now);
  if (inputKey < todayKey) {
    throw new Error(`${fieldLabel} cannot be in the past`);
  }
  return { parsed, inputKey, todayKey };
}

export function validateNotBackdatedWeekStart(input: string | Date, fieldLabel = "weekStart", now: Date = new Date()) {
  const parsed = parseDateInput(input);
  if (!parsed) {
    throw new Error(`Invalid ${fieldLabel}`);
  }
  const inputWeekStartKey = getNairobiDateKey(canonicalNairobiWeekStartUtc(parsed));
  const currentWeekStartKey = getCurrentNairobiWeekStartKey(now);
  if (inputWeekStartKey < currentWeekStartKey) {
    throw new Error(`${fieldLabel} cannot be in a past week`);
  }
  return { parsed, inputWeekStartKey, currentWeekStartKey };
}
