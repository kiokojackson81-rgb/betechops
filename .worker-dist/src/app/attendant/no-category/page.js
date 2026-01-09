"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NoCategoryPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
function NoCategoryPage() {
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 px-4 pb-16 text-slate-50", children: (0, jsx_runtime_1.jsx)("div", { className: "mx-auto w-full max-w-3xl space-y-6 pt-12", children: (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-900/60 p-8 text-center", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Account missing attendant category" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-3 text-slate-300", children: "We couldn't determine your attendant category. This prevents access to attendant-only pages. Please contact your administrator so they can assign your account a valid attendant category." }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 flex justify-center gap-3", children: [(0, jsx_runtime_1.jsx)(link_1.default, { href: "/attendant/login", className: "rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black", children: "Sign in" }), (0, jsx_runtime_1.jsx)("a", { href: "mailto:ops@betech.co.ke", className: "rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10", children: "Contact admin" })] })] }) }) }));
}
