"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptToolbar;
const jsx_runtime_1 = require("react/jsx-runtime");
function ReceiptToolbar({ receiptId }) {
    const downloadUrl = `/api/receipts/${receiptId}/pdf`;
    const toolbarStyle = {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginBottom: '16px',
    };
    const buttonStyle = {
        border: '1px solid #111827',
        background: '#111827',
        color: '#ffffff',
        padding: '8px 16px',
        borderRadius: '6px',
        fontSize: '14px',
        cursor: 'pointer',
    };
    const linkStyle = {
        border: '1px solid #7A2020',
        background: '#7A2020',
        color: '#ffffff',
        padding: '8px 16px',
        borderRadius: '6px',
        fontSize: '14px',
        textDecoration: 'none',
    };
    return ((0, jsx_runtime_1.jsxs)("div", { style: toolbarStyle, children: [(0, jsx_runtime_1.jsx)("button", { type: "button", style: buttonStyle, onClick: () => window.print(), children: "Print" }), (0, jsx_runtime_1.jsx)("a", { href: downloadUrl, target: "_blank", rel: "noreferrer", style: linkStyle, children: "Download PDF" })] }));
}
