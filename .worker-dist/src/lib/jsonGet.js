"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jn = jn;
exports.jnum = jnum;
exports.jstr = jstr;
function jn(obj, ...keys) {
    let current = obj;
    for (const key of keys) {
        if (current == null)
            return undefined;
        current = current[key];
    }
    return current;
}
function jnum(obj, ...keys) {
    const value = jn(obj, ...keys);
    if (value == null)
        return 0;
    const num = typeof value === "object" && typeof value.toNumber === "function" ? value.toNumber() : Number(value);
    return Number.isFinite(num) ? num : 0;
}
function jstr(obj, ...keys) {
    const value = jn(obj, ...keys);
    if (value == null)
        return "";
    return String(value);
}
