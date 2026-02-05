"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = LoginPage;
const jsx_runtime_1 = require("react/jsx-runtime");
exports.dynamic = "force-dynamic";
const react_1 = require("react");
const CredentialLoginForm_1 = __importDefault(require("@/components/CredentialLoginForm"));
function LoginPage() {
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6", children: (0, jsx_runtime_1.jsx)("div", { className: "w-full max-w-md rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]", children: (0, jsx_runtime_1.jsx)(react_1.Suspense, { fallback: (0, jsx_runtime_1.jsx)("div", { className: "py-6", children: "Loading\u2026" }), children: (0, jsx_runtime_1.jsx)(CredentialLoginForm_1.default, { defaultRedirect: "/auth/post-login", title: "BetechOps sign in", description: "Use your @betech.co.ke credentials to access the platform." }) }) }) }));
}
