"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Shortcuts;
const jsx_runtime_1 = require("react/jsx-runtime");
const items = [
    { href: "/attendant/returns/new", label: "New Return" },
    { href: "/attendant/pending-pricing", label: "Pending Pricing" },
    { href: "/attendant/orders/new", label: "Create Order" },
    { href: "/attendant/stock-low", label: "Low Stock" },
    // New shortcut for submitting daily reports
    { href: "/attendant/daily-report", label: "Daily Report" },
];
function Shortcuts() {
    return ((0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-4 backdrop-blur", children: [(0, jsx_runtime_1.jsx)("h2", { className: "mb-3 text-lg font-semibold", children: "Shortcuts" }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: items.map((x) => ((0, jsx_runtime_1.jsx)("a", { href: x.href, className: "rounded-xl border border-white/10 bg-[#0b0e13] px-3 py-2 text-sm hover:bg-white/10", children: x.label }, x.href))) })] }));
}
