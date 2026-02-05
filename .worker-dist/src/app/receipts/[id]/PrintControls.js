"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PrintControls;
const jsx_runtime_1 = require("react/jsx-runtime");
function PrintControls({ receiptId }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => window.print(), className: "px-3 py-1 bg-blue-600 text-white mr-2", children: "Print" }), (0, jsx_runtime_1.jsx)("a", { href: `/api/receipts/${receiptId}/send?channels=email`, className: "px-3 py-1 border mr-2", children: "Send via e-mail" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                    // Placeholder: WhatsApp sending will be implemented later.
                    fetch(`/api/receipts/${receiptId}/send?channels=whatsapp`, { method: 'POST' }).catch(() => { });
                    alert('WhatsApp send queued (placeholder)');
                }, className: "px-3 py-1 border bg-green-600 text-white", children: "Send via WhatsApp" })] }));
}
