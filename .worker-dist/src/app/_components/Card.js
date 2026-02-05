"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Card;
const jsx_runtime_1 = require("react/jsx-runtime");
function Card({ children, className = "", variant = "default", }) {
    const base = "rounded-2xl p-4";
    const variantClass = variant === "kpi"
        ? "border border-[var(--border)] bg-[var(--card-bg)]"
        : variant === "muted"
            ? "border border-white/5 bg-transparent"
            : "border border-white/10 bg-[var(--card,#171b23)] card-top-accent";
    return ((0, jsx_runtime_1.jsx)("div", { className: `${base} ${variantClass} ${className}`, children: children }));
}
