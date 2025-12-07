"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ProgressBar;
const jsx_runtime_1 = require("react/jsx-runtime");
function ProgressBar({ value, max, label }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    const ariaValueNow = Math.max(0, Math.min(value, max));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "progressbar-root", "aria-hidden": false, children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-[11px] opacity-70 mb-1 block", children: [label ?? "Progress", " \u2014 ", (0, jsx_runtime_1.jsxs)("span", { className: "font-medium", children: [value, "/", max] })] }), (0, jsx_runtime_1.jsx)("progress", { className: "w-full h-2 rounded-full", value: ariaValueNow, max: max, "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": ariaValueNow }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs mt-1 opacity-70", children: [pct, "%"] })] }));
}
