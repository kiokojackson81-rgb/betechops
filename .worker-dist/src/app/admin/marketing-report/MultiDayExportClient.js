"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MultiDayExportClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function MultiDayExportClient({ periodKey, userFilter }) {
    const [open, setOpen] = (0, react_1.useState)(false);
    const [selected, setSelected] = (0, react_1.useState)(() => {
        const s = {};
        days.forEach((d) => (s[d] = false));
        return s;
    });
    const toggle = (d) => setSelected((p) => ({ ...p, [d]: !p[d] }));
    const exportCsv = () => {
        const picked = days.filter((d) => selected[d]);
        if (!picked.length)
            return;
        const params = new URLSearchParams();
        if (periodKey)
            params.set("period", periodKey);
        if (userFilter)
            params.set("user", userFilter);
        params.set("dows", picked.join(","));
        const url = `/api/admin/marketing-report/export-period?${params.toString()}`;
        window.open(url, "_blank");
        setOpen(false);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setOpen(true), className: "rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500", children: "Export selected days" }), open && ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-black/60", onClick: () => setOpen(false) }), (0, jsx_runtime_1.jsxs)("div", { className: "relative z-10 w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Export selected days" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Choose which weekdays to include in the export." }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3 grid grid-cols-2 gap-2", children: days.map((d) => ((0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: selected[d], onChange: () => toggle(d) }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: d })] }, d))) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex justify-end gap-2", children: [(0, jsx_runtime_1.jsx)("button", { className: "rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm", onClick: () => setOpen(false), children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { className: "rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm text-black", onClick: exportCsv, children: "Export CSV" })] })] })] }))] }));
}
