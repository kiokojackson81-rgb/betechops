"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NotAuthorizedPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
function NotAuthorizedPage() {
    return ((0, jsx_runtime_1.jsx)("div", { className: "flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full max-w-xl space-y-4 rounded-2xl border border-white/10 bg-[var(--card,#171b23)] bg-slate-900/60 p-8 text-center shadow-2xl shadow-black/60", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm uppercase tracking-widest text-slate-400", children: "Access denied" }), (0, jsx_runtime_1.jsx)("h1", { className: "text-4xl font-semibold text-white", children: "You are not authorized" }), (0, jsx_runtime_1.jsx)("p", { className: "text-base text-slate-300", children: "Your attendant category currently does not have access to this area. Please reach out to an admin if you believe this is incorrect." }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap justify-center gap-3", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: "/", className: "rounded-full border border-white/10 px-6 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/20", children: "Back to home" }) })] }) }));
}
