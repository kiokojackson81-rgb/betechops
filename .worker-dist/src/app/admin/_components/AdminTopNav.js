"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminTopNav;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const adminNav_1 = require("./adminNav");
function AdminTopNav({ mobile = false, className = "" }) {
    const pathname = (0, navigation_1.usePathname)() || "/admin";
    return ((0, jsx_runtime_1.jsx)("nav", { className: "flex gap-1 overflow-x-auto top-nav-scroll " + (mobile ? "px-2" : "px-2 md:px-0") + " " + className, "aria-label": "Admin primary", role: "navigation", children: adminNav_1.NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return ((0, jsx_runtime_1.jsxs)(link_1.default, { href: href, "aria-current": active ? "page" : undefined, className: "nav-link group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border transition-colors whitespace-nowrap pb-2 " +
                    (active
                        ? "bg-white/10 border-white/20 text-white"
                        : "border-transparent text-slate-200 hover:text-white hover:bg-white/5"), tabIndex: 0, children: [(0, jsx_runtime_1.jsx)(Icon, { className: "h-4 w-4 opacity-80 group-hover:opacity-100" }), (0, jsx_runtime_1.jsx)("span", { children: label }), (0, jsx_runtime_1.jsx)("span", { className: "absolute left-2 right-2 -bottom-[2px] h-[2px] rounded bg-gradient-to-r from-indigo-400 via-pink-400 to-violet-400 transform transition-all origin-left " +
                            (active ? "scale-x-100 opacity-90" : "scale-x-0 opacity-0 group-hover:opacity-60 group-hover:scale-x-100") })] }, href));
        }) }));
}
