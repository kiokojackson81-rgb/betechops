"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logInfo = logInfo;
exports.logWarn = logWarn;
exports.logError = logError;
/** Structured logging helpers used across server-side modules. */
function logInfo(msg, meta) {
    if (meta)
        console.info(msg, JSON.stringify(meta));
    else
        console.info(msg);
}
function logWarn(msg, meta) {
    if (meta)
        console.warn(msg, JSON.stringify(meta));
    else
        console.warn(msg);
}
function logError(msg, meta) {
    if (meta)
        console.error(msg, JSON.stringify(meta));
    else
        console.error(msg);
}
