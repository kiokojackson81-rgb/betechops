"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UsersManager;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const definitions_1 = require("@/lib/attendants/definitions");
const toast_1 = require("@/lib/ui/toast");
const categoryFilters = [{ id: "ALL", label: "All categories" }, ...definitions_1.attendantCategoryOptions];
function formatDate(input) {
    const date = new Date(input);
    if (!Number.isFinite(date.valueOf()))
        return "-";
    return date.toLocaleDateString();
}
function UsersManager({ initial }) {
    const [rows, setRows] = (0, react_1.useState)(initial);
    const [filter, setFilter] = (0, react_1.useState)("ALL");
    const [busy, setBusy] = (0, react_1.useState)(null);
    const summary = (0, react_1.useMemo)(() => {
        return rows.reduce((acc, row) => {
            for (const cat of row.categories) {
                acc[cat] = (acc[cat] || 0) + 1;
            }
            return acc;
        }, {});
    }, [rows]);
    const filtered = (0, react_1.useMemo)(() => {
        if (filter === "ALL")
            return rows;
        return rows.filter((row) => row.categories.includes(filter));
    }, [filter, rows]);
    async function updateCategories(id, categories) {
        if (!categories.length) {
            (0, toast_1.showToast)("Select at least one category", "error");
            return;
        }
        setBusy(id);
        const previous = rows.map((row) => ({ ...row }));
        const primary = categories[0];
        setRows((prev) => prev.map((row) => (row.id === id ? { ...row, categories: categories.slice(), attendantCategory: primary } : row)));
        const res = await fetch(`/api/users/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categories, attendantCategory: primary }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            (0, toast_1.showToast)(json?.error || "Failed to update categories", "error");
            setRows(previous);
        }
        else {
            (0, toast_1.showToast)("Categories updated", "success");
        }
        setBusy(null);
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsx)("section", { children: (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-3", children: categoryFilters.map((cat) => {
                        const count = cat.id === "ALL" ? rows.length : summary[cat.id] || 0;
                        return ((0, jsx_runtime_1.jsxs)("button", { onClick: () => setFilter(cat.id), className: `rounded-full border px-3 py-1 text-sm transition ${filter === cat.id ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-slate-300 hover:border-white/20"}`, children: [cat.label, " ", (0, jsx_runtime_1.jsx)("span", { className: "ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs", children: count })] }, cat.id));
                    }) }) }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto rounded-xl border border-white/10", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full divide-y divide-white/10 text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-white/5 text-left uppercase text-[11px] tracking-widest text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 font-medium", children: "Name" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 font-medium", children: "Email" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 font-medium", children: "Role" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 font-medium", children: "Categories" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 font-medium", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 font-medium", children: "Created" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { className: "divide-y divide-white/5 bg-[#0f141f] text-slate-200", children: [filtered.map((row) => {
                                    const activeDefs = row.categories
                                        .map((cat) => definitions_1.attendantCategoryDefinitions.find((c) => c.id === cat))
                                        .filter(Boolean);
                                    return ((0, jsx_runtime_1.jsxs)("tr", { className: "hover:bg-white/5", children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsx)("div", { className: "font-medium text-white", children: row.name || "-" }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-slate-300", children: row.email }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: row.role }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: definitions_1.attendantCategoryOptions.map((opt) => {
                                                                const checked = row.categories.includes(opt.id);
                                                                return ((0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-xs text-slate-300", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", className: "rounded border border-white/20 bg-transparent", checked: checked, disabled: busy === row.id, onChange: (e) => {
                                                                                const next = e.target.checked
                                                                                    ? Array.from(new Set([...row.categories, opt.id]))
                                                                                    : row.categories.filter((c) => c !== opt.id);
                                                                                if (!next.length) {
                                                                                    (0, toast_1.showToast)("User must have at least one category", "error");
                                                                                    return;
                                                                                }
                                                                                updateCategories(row.id, next);
                                                                            } }), (0, jsx_runtime_1.jsx)("span", { children: opt.label })] }, opt.id));
                                                            }) }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: activeDefs.map((def, idx) => ((0, jsx_runtime_1.jsxs)("span", { className: "mr-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium text-white", children: def.label }), idx === 0 ? (0, jsx_runtime_1.jsx)("span", { className: "ml-1 text-emerald-300", children: "(primary)" }) : null] }, def.id))) })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsx)("span", { className: `rounded-full px-2 py-1 text-xs ${row.isActive ? "bg-emerald-600/20 text-emerald-300" : "bg-red-600/20 text-red-300"}`, children: row.isActive ? "Active" : "Inactive" }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-slate-300", children: formatDate(row.createdAt) })] }, row.id));
                                }), filtered.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 6, className: "px-4 py-6 text-center text-slate-400", children: "No attendants in this category yet." }) }))] })] }) })] }));
}
