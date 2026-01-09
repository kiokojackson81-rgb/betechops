"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Error;
const jsx_runtime_1 = require("react/jsx-runtime");
function Error({ error, reset }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-8", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold", children: "Something went wrong loading metrics." }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-slate-300", children: error.message }), (0, jsx_runtime_1.jsx)("button", { onClick: () => reset(), className: "mt-4 rounded-xl px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/20", children: "Try again" })] }));
}
