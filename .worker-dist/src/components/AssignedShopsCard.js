"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AssignedShopsCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const Card_1 = __importDefault(require("@/app/_components/Card"));
function AssignedShopsCard({ rows, loading, weekLabel, }) {
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-3 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Marketplace Overview (Last week)" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Assigned shops" })] }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: weekLabel })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 text-sm", children: [loading && (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Loading shops\u2026" }), !loading && rows.length === 0 && ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "No assigned shops for this week." })), rows.map((shop) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/70 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-slate-100", children: shop.name }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: shop.platform })] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-[11px] text-slate-400", children: [shop.codeLabel, " \u2022 ", shop.country, " \u2022 ", shop.currency] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-[11px] text-slate-400", children: [shop.handlerName, " \u2022 ", shop.handlerRole] })] }, shop.id)))] })] }));
}
