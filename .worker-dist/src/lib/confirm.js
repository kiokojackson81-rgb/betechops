"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmDialog = confirmDialog;
async function confirmDialog(message) {
    if (typeof window === 'undefined')
        return false;
    const id = Math.random().toString(36).slice(2, 9);
    return new Promise((resolve) => {
        function onResp(e) {
            const ev = e;
            if (ev.detail?.id !== id)
                return;
            window.removeEventListener('betechops:confirm-response', onResp);
            resolve(Boolean(ev.detail?.ok));
        }
        window.addEventListener('betechops:confirm-response', onResp);
        window.dispatchEvent(new CustomEvent('betechops:confirm-request', { detail: { id, message } }));
    });
}
exports.default = confirmDialog;
