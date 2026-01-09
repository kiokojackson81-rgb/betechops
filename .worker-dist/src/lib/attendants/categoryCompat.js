"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCategory = normalizeCategory;
exports.isCategoryAllowed = isCategoryAllowed;
const categoryMappings_1 = require("./categoryMappings");
const definitions_1 = require("./definitions");
function toUpperSnake(input) {
    return input
        .trim()
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase();
}
function variantsOf(value) {
    if (value == null)
        return [];
    const s = String(value).trim();
    const v = new Set();
    v.add(s);
    v.add(s.toLowerCase());
    v.add(s.toUpperCase());
    v.add(toUpperSnake(s));
    v.add(s.replace(/[^A-Za-z0-9]+/g, "_").toLowerCase());
    return Array.from(v).filter(Boolean);
}
const canonicalCategories = new Set(definitions_1.attendantCategoryDefinitions.map((def) => def.id));
function resolveCanonical(candidate) {
    const normalized = toUpperSnake(candidate);
    return canonicalCategories.has(normalized) ? normalized : null;
}
function normalizeCategory(value) {
    if (value == null)
        return null;
    for (const variant of variantsOf(value)) {
        const resolved = resolveCanonical(variant);
        if (resolved)
            return resolved;
    }
    const key = String(value ?? "").toLowerCase();
    const mapped = categoryMappings_1.categoryMappings[key];
    if (mapped) {
        for (const entry of mapped) {
            const resolved = resolveCanonical(entry);
            if (resolved)
                return resolved;
        }
    }
    return null;
}
/**
 * Return true if `storedCategory` should be considered allowed for any of the
 * entries in `allowedList`.
 *
 * The check is tolerant: it compares multiple normalization variants and also
 * consults `categoryMappings` for any explicit rank->domain mappings.
 */
function isCategoryAllowed(storedCategory, allowedList) {
    if (!allowedList || allowedList.length === 0)
        return true; // no restriction
    const storedNormalized = normalizeCategory(storedCategory);
    const allowedCanonical = allowedList
        .map((entry) => normalizeCategory(entry))
        .filter((entry) => Boolean(entry));
    if (storedNormalized && allowedCanonical.includes(storedNormalized))
        return true;
    const storedVariants = variantsOf(storedCategory).map((s) => s.toString());
    // Quick direct match (case-insensitive / snake-friendly)
    for (const allowed of allowedList) {
        const allowedVariants = variantsOf(allowed);
        if (allowedVariants.some((av) => storedVariants.includes(av)))
            return true;
    }
    // If there's a mapping for the stored value (e.g. 'junior' -> ['DIRECT_SALES_OPS'])
    // accept if any mapped canonical category is allowed.
    const storedKey = String(storedCategory ?? "").toLowerCase();
    const mapped = categoryMappings_1.categoryMappings[storedKey];
    if (mapped && mapped.length > 0) {
        const mappedUpper = mapped.map((m) => toUpperSnake(m));
        const allowedUpper = allowedList.map((a) => toUpperSnake(a));
        if (mappedUpper.some((m) => allowedUpper.includes(m)))
            return true;
    }
    // Also consider the inverse: allowed entries might map to stored labels.
    for (const allowed of allowedList) {
        const key = String(allowed ?? "").toLowerCase();
        const mappedFromAllowed = categoryMappings_1.categoryMappings[key];
        if (mappedFromAllowed && mappedFromAllowed.length > 0) {
            const mappedVariants = mappedFromAllowed.flatMap((m) => variantsOf(m));
            if (mappedVariants.some((mv) => storedVariants.includes(mv)))
                return true;
        }
    }
    return false;
}
exports.default = isCategoryAllowed;
