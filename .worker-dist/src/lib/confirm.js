"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmDialog = confirmDialog;
async function confirmDialog(message) {
    if (typeof window === 'undefined')
        return false;
    const id = Math.random().toString(36).slice(2, 9);
    return new Promise((resolve) => {
        function onResp(e) {
            var _a, _b;
            const ev = e;
            if (((_a = ev.detail) === null || _a === void 0 ? void 0 : _a.id) !== id)
                return;
            window.removeEventListener('betechops:confirm-response', onResp);
            resolve(Boolean((_b = ev.detail) === null || _b === void 0 ? void 0 : _b.ok));
        }
        window.addEventListener('betechops:confirm-response', onResp);
        window.dispatchEvent(new CustomEvent('betechops:confirm-request', { detail: { id, message } }));
    });
}
exports.default = confirmDialog;
