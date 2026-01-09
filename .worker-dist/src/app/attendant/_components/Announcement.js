"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Announcement;
const jsx_runtime_1 = require("react/jsx-runtime");
function Announcement() {
    return ((0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-gradient-to-br from-purple-600/10 to-blue-600/10 p-4 backdrop-blur", children: [(0, jsx_runtime_1.jsx)("h2", { className: "mb-2 text-lg font-semibold", children: "Announcements" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Remember to set buying prices for new items before checkout. Returns must include a photo." })] }));
}
