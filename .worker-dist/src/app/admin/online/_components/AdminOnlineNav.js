"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminOnlineNav;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const tabs = [
    { href: "/admin/online/summary", label: "Summary" },
    { href: "/admin/online/accounts", label: "Accounts" },
    { href: "/admin/online/returns", label: "Returns" },
];
function AdminOnlineNav() {
    const pathname = (0, navigation_1.usePathname)();
    return ((0, jsx_runtime_1.jsx)("nav", { className: "flex flex-wrap gap-2 text-sm font-semibold text-slate-300", children: tabs.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return ((0, jsx_runtime_1.jsx)(link_1.default, { href: tab.href, className: `rounded-full border px-4 py-1.5 transition ${active
                    ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 text-slate-300 hover:border-emerald-400/60 hover:text-emerald-200"}`, children: tab.label }, tab.href));
        }) }));
}
