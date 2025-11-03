"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toast = toast;
function toast(message, kind = 'info') {
    if (typeof window === 'undefined')
        return;
    try {
        window.dispatchEvent(new CustomEvent('betechops:toast', { detail: { message, type: kind } }));
    }
    catch (e) {
        // best-effort
        // log to console if available
        console.warn('toast failed', e);
    }
}
exports.default = toast;
