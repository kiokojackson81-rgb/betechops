"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminHealthChecks;
const jsx_runtime_1 = require("react/jsx-runtime");
const health_1 = require("@/lib/health");
const AutoRefresh_1 = __importDefault(require("@/app/_components/AutoRefresh"));
const headers_1 = require("next/headers");
async function fetchJson(path) {
    try {
        const h = await (0, headers_1.headers)();
        const proto = h.get("x-forwarded-proto") ?? "https";
        const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
        const origin = host ? `${proto}://${host}` : "";
        const url = path.startsWith("http") ? path : `${origin}${path}`;
        const r = await fetch(url, { cache: "no-store" });
        const data = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, data };
    }
    catch (e) {
        return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : String(e) } };
    }
}
async function AdminHealthChecks() {
    // Use server-side helper for health to avoid URL parsing issues
    const healthPayload = await (0, health_1.computeHealth)();
    const [oidc, oidcTest, jumiaDiag] = await Promise.all([
        fetchJson("/api/debug/oidc"),
        fetchJson("/api/debug/oidc?test=true"),
        fetchJson("/api/debug/jumia"),
    ]);
    const shops = await (0, health_1.computeShopsConnectivity)();
    const Section = ({ title, payload }) => ((0, jsx_runtime_1.jsxs)("section", { className: "rounded-xl border border-white/10 bg-white/5 p-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "mb-2 text-lg font-semibold", children: title }), (0, jsx_runtime_1.jsx)("pre", { className: "overflow-x-auto text-xs text-slate-200", children: JSON.stringify(payload, null, 2) })] }));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-5xl p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Operational Checks" }), (0, jsx_runtime_1.jsx)(AutoRefresh_1.default, { intervalMs: 60000 }), (0, jsx_runtime_1.jsx)("p", { className: "text-slate-400", children: "Quick diagnostics for DB and Jumia OIDC integration." }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsx)(Section, { title: "API /health", payload: { ok: true, status: 200, data: healthPayload } }), (0, jsx_runtime_1.jsx)(Section, { title: "OIDC env /api/debug/oidc", payload: oidc }), (0, jsx_runtime_1.jsx)(Section, { title: "OIDC token test /api/debug/oidc?test=true", payload: oidcTest }), (0, jsx_runtime_1.jsx)(Section, { title: "Jumia connectivity /api/debug/jumia", payload: jumiaDiag })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-xl border border-white/10 bg-white/5 p-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "mb-3 text-lg font-semibold", children: "Shops connectivity" }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-white/10", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "text-left px-3 py-2", children: "Shop" }), (0, jsx_runtime_1.jsx)("th", { className: "text-left px-3 py-2", children: "Platform" }), (0, jsx_runtime_1.jsx)("th", { className: "text-left px-3 py-2", children: "Active" }), (0, jsx_runtime_1.jsx)("th", { className: "text-left px-3 py-2", children: "Ping" }), (0, jsx_runtime_1.jsx)("th", { className: "text-left px-3 py-2", children: "Last activity" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [shops.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 5, className: "px-3 py-4 text-center text-slate-400", children: "No shops found." }) })), shops.map((s) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-white/10", children: [(0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: s.name }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: s.platform }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: s.isActive ? 'Yes' : 'No' }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: s.ping.ok ? ((0, jsx_runtime_1.jsxs)("span", { className: "text-green-400", children: ["OK", s.ping.count !== undefined ? ` (${s.ping.count})` : ''] })) : ((0, jsx_runtime_1.jsxs)("span", { className: "text-red-400", children: [s.ping.status ? `${s.ping.status}` : '', " ", s.ping.error || 'error'] })) }), (0, jsx_runtime_1.jsxs)("td", { className: "px-3 py-2", children: [s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : '-', (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: [s.lastActivity.order && (0, jsx_runtime_1.jsxs)("span", { className: "mr-2", children: ["Order: ", new Date(s.lastActivity.order).toLocaleDateString()] }), s.lastActivity.settlement && (0, jsx_runtime_1.jsxs)("span", { className: "mr-2", children: ["Settlement: ", new Date(s.lastActivity.settlement).toLocaleDateString()] }), s.lastActivity.fulfillment && (0, jsx_runtime_1.jsxs)("span", { className: "mr-2", children: ["Fulfill: ", new Date(s.lastActivity.fulfillment).toLocaleDateString()] }), s.lastActivity.returns && (0, jsx_runtime_1.jsxs)("span", { className: "mr-2", children: ["Return: ", new Date(s.lastActivity.returns).toLocaleDateString()] })] })] })] }, s.id)))] })] }) })] })] }));
}
