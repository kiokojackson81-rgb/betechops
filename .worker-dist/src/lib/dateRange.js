"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endOfDay = exports.startOfDay = exports.parseDateParam = void 0;
const startOfDay = (value) => {
    const clone = new Date(value);
    clone.setHours(0, 0, 0, 0);
    return clone;
};
exports.startOfDay = startOfDay;
const endOfDay = (value) => {
    const clone = new Date(value);
    clone.setHours(23, 59, 59, 999);
    return clone;
};
exports.endOfDay = endOfDay;
const parseDateParam = (value, fallback, toEnd = false) => {
    if (!value)
        return toEnd ? endOfDay(fallback) : startOfDay(fallback);
    const isPlainYMD = /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.includes("T");
    try {
        if (isPlainYMD) {
            const iso = toEnd ? `${value}T23:59:59.999+03:00` : `${value}T00:00:00+03:00`;
            const parsed = new Date(iso);
            if (Number.isNaN(parsed.getTime()))
                throw new Error("invalid date");
            return parsed;
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime()))
            return toEnd ? endOfDay(fallback) : startOfDay(fallback);
        return parsed;
    }
    catch (err) {
        return toEnd ? endOfDay(fallback) : startOfDay(fallback);
    }
};
exports.parseDateParam = parseDateParam;
