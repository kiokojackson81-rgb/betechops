"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = RestoreConfirmModal;
const jsx_runtime_1 = require("react/jsx-runtime");
function RestoreConfirmModal({ open, token, expiresAt, loading, error, onCancel, onConfirm, }) {
    if (!open)
        return null;
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(token || "");
            // simple feedback
            // eslint-disable-next-line no-alert
            alert("Token copied to clipboard");
        }
        catch (e) {
            // eslint-disable-next-line no-alert
            alert("Failed to copy token");
        }
    };
    const hasToken = !!token;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 bg-black/50", onClick: onCancel }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white dark:bg-zinc-900 rounded shadow-lg p-6 z-10 w-[420px]", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold mb-2", children: hasToken ? "Confirm Forced Restore" : "Confirm Restore" }), !hasToken && (0, jsx_runtime_1.jsx)("p", { className: "text-sm mb-3", children: "Confirm that you want to restore receipts/items for this day." }), hasToken && (0, jsx_runtime_1.jsx)("p", { className: "text-sm mb-3", children: "A short-lived confirmation token was generated. Copy it and confirm to proceed with the forced restore." }), hasToken && ((0, jsx_runtime_1.jsxs)("div", { className: "bg-zinc-100 dark:bg-zinc-800 p-3 rounded mb-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-mono text-sm break-all", children: token }), (0, jsx_runtime_1.jsx)("button", { onClick: handleCopy, className: "ml-3 px-2 py-1 bg-slate-200 rounded text-sm", children: "Copy" })] }), expiresAt && (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-zinc-500 mt-2", children: ["Expires: ", expiresAt] })] })), error && (0, jsx_runtime_1.jsx)("div", { className: "text-rose-500 text-sm mb-2", children: error }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-end gap-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: onCancel, className: "px-3 py-1 rounded border", children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { onClick: onConfirm, disabled: !!loading, className: "px-3 py-1 rounded bg-emerald-600 text-black", children: loading ? "Restoring..." : hasToken ? "Confirm & Restore" : "Confirm" })] })] })] }));
}
