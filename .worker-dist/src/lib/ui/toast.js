"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showToast = showToast;
exports.confirmDialog = confirmDialog;
function showToast(message, type = 'info') {
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new CustomEvent('betechops:toast', { detail: { message, type } }));
}
// Simple confirm helper that currently falls back to window.confirm.
// We emit an event for potential client listeners, but return the native confirm result.
async function confirmDialog(message) {
    if (typeof window === 'undefined')
        return false;
    // promise-based confirm: dispatch a request and wait for a response event
    const id = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
        function onResponse(e) {
            var _a, _b;
            const ev = e;
            if (((_a = ev.detail) === null || _a === void 0 ? void 0 : _a.id) !== id)
                return;
            window.removeEventListener('betechops:confirm-response', onResponse);
            resolve(Boolean((_b = ev.detail) === null || _b === void 0 ? void 0 : _b.ok));
        }
        window.addEventListener('betechops:confirm-response', onResponse);
        window.dispatchEvent(new CustomEvent('betechops:confirm-request', { detail: { id, message } }));
        // fallback timeout: if nobody responds within 20s, use native confirm
        setTimeout(() => {
            try {
                window.removeEventListener('betechops:confirm-response', onResponse);
            }
            catch (_a) { }
            resolve(window.confirm(message));
        }, 20000);
    });
}
