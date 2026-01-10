"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDateOnlyUtc = parseDateOnlyUtc;
exports.canonicalNairobiWeekStartUtc = canonicalNairobiWeekStartUtc;
exports.mondayToSundayNairobiWindow = mondayToSundayNairobiWindow;
exports.buildUtcWeekStartIso = buildUtcWeekStartIso;
exports.normalizeWeekStartFromParam = normalizeWeekStartFromParam;
exports.formatNairobiDate = formatNairobiDate;
function parseDateOnlyUtc(value) {
    if (!value)
        return null;
    const datePart = String(value).slice(0, 10);
    const parts = datePart.split("-").map((v) => Number(v));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n)))
        return null;
    const [year, month, day] = parts;
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}
const NAIROBI_TZ = "Africa/Nairobi";
const NAIROBI_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
});
const NAIROBI_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
});
function extractNairobiDateParts(dateUtc) {
    const parts = NAIROBI_DATE_FORMATTER.formatToParts(dateUtc);
    const yearPart = parts.find((p) => p.type === "year")?.value ?? "";
    const monthPart = parts.find((p) => p.type === "month")?.value ?? "";
    const dayPart = parts.find((p) => p.type === "day")?.value ?? "";
    return {
        year: Number(yearPart),
        month: Number(monthPart),
        day: Number(dayPart),
    };
}
// Canonical Nairobi week start (UTC) helper. Interprets any input Date as
// a UTC timestamp and returns the canonical UTC Monday midnight for the
// Nairobi-local week (UTC+3). This mirrors the canonicaliser used in
// recompute and ingestion so UI slugs/parsing are deterministic.
function canonicalNairobiWeekStartUtc(dateUtc) {
    const { year, month, day } = extractNairobiDateParts(dateUtc);
    if ([year, month, day].some((value) => Number.isNaN(value))) {
        return new Date(Date.UTC(dateUtc.getUTCFullYear(), dateUtc.getUTCMonth(), dateUtc.getUTCDate(), 0, 0, 0, 0));
    }
    const nairobiDateUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const currentDay = nairobiDateUtc.getUTCDay();
    const deltaToMonday = (currentDay + 6) % 7;
    nairobiDateUtc.setUTCDate(nairobiDateUtc.getUTCDate() - deltaToMonday);
    return nairobiDateUtc;
}
function mondayToSundayNairobiWindow(baseInstant) {
    const weekStart = canonicalNairobiWeekStartUtc(baseInstant);
    // Store weekEnd as exclusive (next Monday 00:00 UTC) so DB intervals are
    // canonical [weekStart, weekEnd) and easier to reason about for overlaps.
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);
    return { weekStart, weekEnd };
}
function buildUtcWeekStartIso(date) {
    return mondayToSundayNairobiWindow(date).weekStart.toISOString();
}
function normalizeWeekStartFromParam(raw) {
    if (!raw)
        return null;
    let parsedValue = raw;
    for (let i = 0; i < 3; i += 1) {
        try {
            const decoded = decodeURIComponent(parsedValue);
            if (decoded === parsedValue)
                break;
            parsedValue = decoded;
        }
        catch {
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
function formatNairobiDate(date) {
    return NAIROBI_LABEL_FORMATTER.format(date).replace(/,/g, "");
}
