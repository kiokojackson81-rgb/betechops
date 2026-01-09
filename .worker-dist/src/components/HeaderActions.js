"use strict";
"use client";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = HeaderActions;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
function HeaderActions({ receiptsHref = "/marketing/receipts", createHref = "/receipts", onSignOut, onReceiptsClick, showDot = false, }) {
    return ((0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-2 items-start sm:items-end", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3 items-center", children: [(0, jsx_runtime_1.jsxs)(link_1.default, { href: receiptsHref, "aria-label": "My receipts", onClick: onReceiptsClick, className: "relative flex items-center gap-2 rounded-full border border-white/10 bg-white/3 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-slate-100 transition-colors duration-150 hover:border-white/30 hover:bg-white/5", children: [showDot && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("span", { className: "absolute -top-2 -left-3 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-slate-950" }), (0, jsx_runtime_1.jsx)("span", { className: "absolute -top-2 -left-3 h-2 w-2 rounded-full bg-rose-500 opacity-60 animate-ping" })] })), "Receipts"] }), (0, jsx_runtime_1.jsx)(link_1.default, { href: createHref, className: "flex items-center gap-2 rounded-full border-2 border-emerald-400 bg-transparent px-6 py-2 text-sm font-semibold uppercase tracking-wide text-emerald-100 transition-shadow duration-150 hover:shadow-[0_6px_18px_rgba(16,185,129,0.12)] hover:bg-emerald-600/5", "aria-label": "Create receipt", children: "Create receipt" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onSignOut && onSignOut(), className: "rounded-full border border-white/10 bg-white/3 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-slate-100 transition-colors duration-150 hover:border-white/30 hover:bg-white/5", children: "Log out" })] }) }));
}
