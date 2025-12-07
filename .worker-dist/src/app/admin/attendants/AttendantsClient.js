"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantsClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const getLandingPage_1 = __importStar(require("@/lib/getLandingPage"));
function AttendantsClient({ attendants }) {
    const router = (0, navigation_1.useRouter)();
    const [rows, setRows] = (0, react_1.useState)(attendants);
    const [filterCategory, setFilterCategory] = (0, react_1.useState)("ALL");
    const [filterStatus, setFilterStatus] = (0, react_1.useState)("ALL");
    const [loadingId, setLoadingId] = (0, react_1.useState)(null);
    const filtered = rows.filter((a) => {
        if (filterCategory !== "ALL" && a.attendantCategory !== filterCategory)
            return false;
        if (filterStatus === "ACTIVE" && !a.isActive)
            return false;
        if (filterStatus === "DISABLED" && a.isActive)
            return false;
        return true;
    });
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-slate-950 text-slate-100 p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex items-center justify-between mb-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Attendants" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Manage attendant categories, status, passwords and dashboards." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3", children: [(0, jsx_runtime_1.jsx)("button", { className: "text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800", onClick: () => router.push("/admin/payroll"), children: "Payroll overview" }), (0, jsx_runtime_1.jsxs)("select", { value: filterCategory, onChange: (e) => setFilterCategory(e.target.value), className: "rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm", children: [(0, jsx_runtime_1.jsx)("option", { value: "ALL", children: "All categories" }), (0, jsx_runtime_1.jsx)("option", { value: "DIRECT_SALES_OPS", children: "Direct Sales Ops" }), (0, jsx_runtime_1.jsx)("option", { value: "MARKETING_OPS", children: "Marketing Ops" }), (0, jsx_runtime_1.jsx)("option", { value: "JUMIA_KILIMALL_OPS", children: "Jumia / Kilimall Ops" }), (0, jsx_runtime_1.jsx)("option", { value: "SUPPORT_OPS", children: "Support Ops" }), (0, jsx_runtime_1.jsx)("option", { value: "BETECH_OPS", children: "Betech Ops" })] }), (0, jsx_runtime_1.jsxs)("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm", children: [(0, jsx_runtime_1.jsx)("option", { value: "ALL", children: "All statuses" }), (0, jsx_runtime_1.jsx)("option", { value: "ACTIVE", children: "Active" }), (0, jsx_runtime_1.jsx)("option", { value: "DISABLED", children: "Disabled" })] })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl overflow-hidden", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-slate-900/80 border-b border-white/10 text-xs uppercase text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left", children: "Name" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left", children: "Email" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left", children: "Category" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right", children: "Actions" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [filtered.map((a) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-white/5", children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: a.name ? ((0, jsx_runtime_1.jsx)("a", { href: `${(0, getLandingPage_1.getAdminLandingPage)(a.attendantCategory)}?impersonateId=${a.id}`, target: "_blank", rel: "noopener noreferrer", className: "text-left text-slate-100 hover:underline", children: a.name })) : ("-") }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsx)("a", { href: `${(0, getLandingPage_1.getAdminLandingPage)(a.attendantCategory)}?impersonateId=${a.id}`, target: "_blank", rel: "noopener noreferrer", className: "text-left text-slate-300 hover:underline", children: a.email }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: a.categoryLabel ?? (a.attendantCategory ?? "Unassigned") }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
                                                    (a.isActive ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40" : "bg-red-500/15 text-red-300 border border-red-500/40"), children: a.isActive ? "Active" : "Disabled" }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-right", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-end gap-2", children: [(0, jsx_runtime_1.jsx)("button", { className: "text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800", onClick: () => router.push(`/admin/attendants/${a.id}`), children: "Edit" }), (0, jsx_runtime_1.jsx)("button", { className: "text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800", onClick: () => router.push(`/admin/attendants/${a.id}/payroll`), children: "Payroll" }), (0, jsx_runtime_1.jsx)("a", { href: `${(0, getLandingPage_1.default)(a.attendantCategory || null)}?impersonateId=${a.id}`, target: "_blank", rel: "noopener noreferrer", className: "text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800 inline-flex items-center justify-center", children: "Open dashboard" }), a.isActive ? ((0, jsx_runtime_1.jsx)("button", { className: "text-xs rounded-full border border-amber-600 px-3 py-1 hover:bg-slate-800", disabled: loadingId === a.id, onClick: async () => {
                                                            if (!confirm(`Disable ${a.email}?`))
                                                                return;
                                                            setLoadingId(a.id);
                                                            try {
                                                                const res = await fetch(`/api/admin/attendants/${a.id}`, {
                                                                    method: "PATCH",
                                                                    headers: { "content-type": "application/json" },
                                                                    body: JSON.stringify({ action: "deactivate" }),
                                                                });
                                                                if (!res.ok)
                                                                    throw new Error("Request failed");
                                                                setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, isActive: false } : r)));
                                                            }
                                                            catch (err) {
                                                                alert("Failed to disable attendant");
                                                            }
                                                            finally {
                                                                setLoadingId(null);
                                                            }
                                                        }, children: "Disable" })) : ((0, jsx_runtime_1.jsx)("button", { className: "text-xs rounded-full border border-emerald-600 px-3 py-1 hover:bg-slate-800", disabled: loadingId === a.id, onClick: async () => {
                                                            if (!confirm(`Activate ${a.email}?`))
                                                                return;
                                                            setLoadingId(a.id);
                                                            try {
                                                                const res = await fetch(`/api/admin/attendants/${a.id}`, {
                                                                    method: "PATCH",
                                                                    headers: { "content-type": "application/json" },
                                                                    body: JSON.stringify({ action: "activate" }),
                                                                });
                                                                if (!res.ok)
                                                                    throw new Error("Request failed");
                                                                setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, isActive: true } : r)));
                                                            }
                                                            catch (err) {
                                                                alert("Failed to activate attendant");
                                                            }
                                                            finally {
                                                                setLoadingId(null);
                                                            }
                                                        }, children: "Activate" }))] }) })] }, a.id))), filtered.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 5, className: "px-4 py-6 text-center text-slate-500", children: "No attendants found with the current filters." }) }))] })] }) })] }));
}
