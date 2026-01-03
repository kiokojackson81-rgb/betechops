function splitPeriodKey(key: string): [string, string] | null {
  const normalized = key.trim();
  if (!normalized) return null;
  const underscoreIndex = normalized.indexOf("_");
  if (underscoreIndex >= 0) {
    return [normalized.slice(0, underscoreIndex), normalized.slice(underscoreIndex + 1)];
  }
  const colonIndex = normalized.indexOf(":");
  if (colonIndex >= 0) {
    return [normalized.slice(0, colonIndex), normalized.slice(colonIndex + 1)];
  }
  return null;
}

function createVariantsFromDates(start: Date, end: Date): string[] {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const startDateOnly = startIso.split("T")[0];
  const endDateOnly = endIso.split("T")[0];
  return [`${startDateOnly}_${endDateOnly}`, `${startIso}_${endIso}`];
}

export function getPeriodKeyVariantsFromDates(start: Date, end: Date): string[] {
  return createVariantsFromDates(start, end);
}

export function getPeriodKeyVariants(periodKey?: string | null): string[] {
  if (!periodKey) return [];
  const normalized = periodKey.trim();
  if (!normalized) return [];

  const variants = new Set<string>();
  variants.add(normalized);

  const parsed = splitPeriodKey(normalized);
  if (!parsed) {
    return Array.from(variants);
  }

  const [startPart, endPart] = parsed;
  const startDate = new Date(startPart);
  const endDate = new Date(endPart);
  for (const key of createVariantsFromDates(startDate, endDate)) {
    variants.add(key);
  }

  return Array.from(variants);
}
