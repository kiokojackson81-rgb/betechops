"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminStatusBanner;
const jsx_runtime_1 = require("react/jsx-runtime");
// Server component: shows a small operational status banner for Admin
const lucide_react_1 = require("lucide-react");
const headers_1 = require("next/headers");
async function AdminStatusBanner() {
    let health = null;
    // Construct absolute origin from headers to satisfy Node fetch
    const h = await (0, headers_1.headers)();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const origin = host ? `${proto}://${host}` : "";
    try {
        const base = origin || process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
        const url = `${base || ''}/api/health`.replace(/([^:]\/)\/+/g, '$1/');
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok)
            health = (await r.json());
    }
    catch {
        // ignore
    }
    if (!health) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2", children: "Unable to reach /api/health. Check deployment and network." }));
    }
    const issues = [];
    if (!health.dbOk)
        issues.push("Database not reachable or migrations not applied");
    if (!health.authReady)
        issues.push("NextAuth env vars not set (NEXTAUTH_SECRET, Google client)");
    if (issues.length === 0) {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm px-3 py-2 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Info, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "System OK" }), (0, jsx_runtime_1.jsx)("span", { className: "opacity-70", children: "\u2022" }), (0, jsx_runtime_1.jsxs)("span", { children: ["Products: ", health.productCount] }), typeof health.dbHost === "string" && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("span", { className: "opacity-70", children: "\u2022" }), (0, jsx_runtime_1.jsxs)("span", { children: ["DB: ", health.dbScheme || "?", " @", health.dbHost] })] }))] }));
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: "bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-sm px-3 py-2", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-4 w-4 mt-0.5" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: "Operational warnings" }), (0, jsx_runtime_1.jsx)("ul", { className: "list-disc ml-5", children: issues.map((m, i) => (0, jsx_runtime_1.jsx)("li", { children: m }, i)) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 opacity-80", children: ["See ", (0, jsx_runtime_1.jsx)("a", { className: "underline", href: "/admin/health-checks", children: "Admin \u2192 Health Checks" }), " for details."] })] })] }) }));
}
