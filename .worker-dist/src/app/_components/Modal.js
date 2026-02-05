"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Modal;
const jsx_runtime_1 = require("react/jsx-runtime");
function Modal({ title, open, onClose, children }) {
    if (!open)
        return null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-black/60", onClick: onClose }), (0, jsx_runtime_1.jsxs)("div", { className: "relative max-w-2xl w-full bg-white/5 border border-white/10 rounded-lg p-6 text-slate-100 z-10", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: title }), (0, jsx_runtime_1.jsx)("button", { "aria-label": "Close modal", onClick: onClose, className: "text-slate-300 hover:text-white", children: "\u2715" })] }), (0, jsx_runtime_1.jsx)("div", { className: "max-h-[60vh] overflow-auto", children: children })] })] }));
}
