"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminTips;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const TIPS = [
    "Use Shops & Staff to add Jumia/Kilimall shops + assign staff.",
    "Orders → Pending/RTS/Delivered filters are one click away.",
    "Catalog → price/stock/status feeds & feed history.",
];
function AdminTips() {
    const [dismissed, setDismissed] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => { setDismissed(localStorage.getItem("adminTipsDismissed") === "1"); }, []);
    function hide() { localStorage.setItem("adminTipsDismissed", "1"); setDismissed(true); }
    if (dismissed)
        return null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mt-8 grid gap-3 md:grid-cols-3", children: [TIPS.map(t => ((0, jsx_runtime_1.jsx)("div", { className: "relative rounded-xl bg-[var(--card,#171b23)] border border-white/10 p-4 text-xs md:text-sm", children: (0, jsx_runtime_1.jsx)("p", { className: "pr-6 leading-relaxed text-slate-300", children: t }) }, t))), (0, jsx_runtime_1.jsx)("button", { "aria-label": "Dismiss tips", onClick: hide, className: "absolute -mt-5 right-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 hover:text-white", children: "Dismiss \u00D7" })] }));
}
