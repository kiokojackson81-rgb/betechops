"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Loading;
const jsx_runtime_1 = require("react/jsx-runtime");
function Loading() {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-8 animate-pulse", children: [(0, jsx_runtime_1.jsx)("div", { className: "h-6 w-56 bg-white/10 rounded mb-4" }), (0, jsx_runtime_1.jsx)("div", { className: "grid md:grid-cols-3 gap-4", children: [...Array(5)].map((_, i) => ((0, jsx_runtime_1.jsx)("div", { className: "h-24 rounded-2xl border border-white/10 bg-white/5" }, i))) })] }));
}
