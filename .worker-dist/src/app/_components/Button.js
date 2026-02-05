"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Button;
const jsx_runtime_1 = require("react/jsx-runtime");
function Button({ children, onClick, variant = "primary", className = "", type = "button", style, disabled = false, }) {
    const base = "rounded-xl px-4 py-2 focus:outline-none inline-flex items-center justify-center gap-2 text-sm";
    const variants = {
        primary: "bg-betech-orange text-black font-semibold hover:brightness-95",
        secondary: "border border-white/10 text-slate-200 bg-transparent hover:bg-white/5",
        danger: "bg-betech-maroon text-white font-semibold hover:opacity-95",
        muted: "border border-white/5 text-slate-300 bg-transparent",
    };
    return ((0, jsx_runtime_1.jsx)("button", { type: type, onClick: onClick, style: style, disabled: disabled, className: `${base} ${variants[variant]} ${className} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`, children: children }));
}
