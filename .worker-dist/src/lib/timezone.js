"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowInNairobi = nowInNairobi;
// Provides the current Date in Africa/Nairobi without extra runtime deps.
function nowInNairobi() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const nairobiOffsetMs = 3 * 60 * 60 * 1000; // UTC+3
    return new Date(utc + nairobiOffsetMs);
}
