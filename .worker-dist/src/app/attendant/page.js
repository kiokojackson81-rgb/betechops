"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantDashboard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const QueueList_1 = __importDefault(require("./_components/QueueList"));
const QuickPriceCard_1 = __importDefault(require("./_components/QuickPriceCard"));
const ReturnsCard_1 = __importDefault(require("./_components/ReturnsCard"));
const ShopSnapshot_1 = __importDefault(require("./_components/ShopSnapshot"));
const Shortcuts_1 = __importDefault(require("./_components/Shortcuts"));
const Announcement_1 = __importDefault(require("./_components/Announcement"));
const DailySalesCard_1 = __importDefault(require("./_components/DailySalesCard"));
const ProductUploadsCard_1 = __importDefault(require("./_components/ProductUploadsCard"));
const Button_1 = __importDefault(require("@/app/_components/Button"));
const Sparkline_1 = __importDefault(require("@/app/_components/Sparkline"));
const definitions_1 = require("@/lib/attendants/definitions");
const PRIMARY_WIDGETS = new Set(["QUEUE", "PRICING", "RETURNS", "DAILY_SALES", "PRODUCT_UPLOADS"]);
function renderWidget(widget, shopId) {
    switch (widget) {
        case "QUEUE":
            return (0, jsx_runtime_1.jsx)(QueueList_1.default, { shopId: shopId ?? undefined });
        case "PRICING":
            return (0, jsx_runtime_1.jsx)(QuickPriceCard_1.default, {});
        case "RETURNS":
            return (0, jsx_runtime_1.jsx)(ReturnsCard_1.default, {});
        case "SHOP_SNAPSHOT":
            return (0, jsx_runtime_1.jsx)(ShopSnapshot_1.default, { shopId: shopId ?? undefined });
        case "SHORTCUTS":
            return (0, jsx_runtime_1.jsx)(Shortcuts_1.default, {});
        case "ANNOUNCEMENTS":
            return (0, jsx_runtime_1.jsx)(Announcement_1.default, {});
        case "DAILY_SALES":
            return (0, jsx_runtime_1.jsx)(DailySalesCard_1.default, {});
        case "PRODUCT_UPLOADS":
            return (0, jsx_runtime_1.jsx)(ProductUploadsCard_1.default, {});
        default:
            return null;
    }
}
function AttendantDashboard() {
    // impersonateId is read from the client-side URL when performing fetches
    const impersonateIdFromWindow = () => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("impersonateId") : null);
    const [shopId, setShopId] = (0, react_1.useState)(undefined);
    const [profile, setProfile] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [shops, setShops] = (0, react_1.useState)([]);
    const [loadingShops, setLoadingShops] = (0, react_1.useState)(true);
    const [summary, setSummary] = (0, react_1.useState)(null);
    const [recentReports, setRecentReports] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        const saved = typeof window !== "undefined" ? localStorage.getItem("shopId") || undefined : undefined;
        setShopId(saved || undefined);
        void fetchProfile();
        void fetchShops();
        void fetchSummary();
    }, []);
    async function fetchSummary() {
        try {
            const imp = impersonateIdFromWindow();
            const qp = imp ? `?page=1&pageSize=6&impersonateId=${encodeURIComponent(imp)}` : `?page=1&pageSize=6`;
            const res = await fetch(`/api/daily-report${qp}`, { cache: "no-store" });
            if (!res.ok)
                return;
            const data = await res.json();
            setSummary(data.summary ?? null);
            const reports = (data.reports ?? []).map((r) => ({ date: r.date, productsCount: r.productsCount ?? 0, totalSales: r.totalSales ?? 0 }));
            setRecentReports(reports);
        }
        catch {
            // ignore
        }
    }
    async function fetchProfile() {
        try {
            const imp = impersonateIdFromWindow();
            const url = imp ? `/api/attendants/me?impersonateId=${encodeURIComponent(imp)}` : "/api/attendants/me";
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok)
                return;
            const data = (await res.json());
            setProfile(data.user);
        }
        catch {
            // ignore for now; dashboard will fallback to defaults
        }
        finally {
            setLoading(false);
        }
    }
    async function fetchShops() {
        try {
            const imp = impersonateIdFromWindow();
            const url = imp ? `/api/attendants/shops?impersonateId=${encodeURIComponent(imp)}` : "/api/attendants/shops";
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok)
                return;
            const data = (await res.json());
            setShops(data);
            if (data.length) {
                setShopId((prev) => {
                    if (prev && data.some((shop) => shop.id === prev))
                        return prev;
                    if (data.length === 1) {
                        if (typeof window !== "undefined")
                            localStorage.setItem("shopId", data[0].id);
                        return data[0].id;
                    }
                    if (typeof window !== "undefined")
                        localStorage.removeItem("shopId");
                    return undefined;
                });
            }
            else {
                if (typeof window !== "undefined")
                    localStorage.removeItem("shopId");
                setShopId(undefined);
            }
        }
        catch {
            // ignore network error for now
        }
        finally {
            setLoadingShops(false);
        }
    }
    const categoryOrder = (0, react_1.useMemo)(() => {
        const fallback = profile?.attendantCategory ?? "DIRECT_SALES_OPS";
        const raw = profile?.categories ?? [];
        const ordered = [fallback, ...raw].filter(Boolean);
        return Array.from(new Set(ordered));
    }, [profile?.attendantCategory, profile?.categories]);
    const definitions = (0, react_1.useMemo)(() => {
        if (categoryOrder.length) {
            return categoryOrder.map((cat) => definitions_1.attendantCategoryById[cat] ?? definitions_1.attendantCategoryById["DIRECT_SALES_OPS"]);
        }
        return [definitions_1.attendantCategoryById["DIRECT_SALES_OPS"]];
    }, [categoryOrder]);
    const widgets = (0, react_1.useMemo)(() => {
        const widgetSequence = [];
        for (const def of definitions) {
            for (const widget of def.defaultWidgets) {
                if (!widgetSequence.includes(widget))
                    widgetSequence.push(widget);
            }
        }
        const nodes = widgetSequence
            .map((id) => ({ id, node: renderWidget(id, shopId) }))
            .filter((item) => Boolean(item.node));
        const primary = nodes.filter((n) => PRIMARY_WIDGETS.has(n.id));
        const secondary = nodes.filter((n) => !PRIMARY_WIDGETS.has(n.id));
        return { primary, secondary };
    }, [definitions, shopId]);
    return ((0, jsx_runtime_1.jsx)("div", { className: "page-shell py-6 text-slate-100", children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Attendant Dashboard" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-widest text-slate-300", children: definitions.map((def, idx) => ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: def.label }), idx === 0 ? (0, jsx_runtime_1.jsx)("span", { className: "rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-200", children: "Primary" }) : null] }, def.id))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-slate-400", children: "Shop:" }), (0, jsx_runtime_1.jsxs)("select", { className: "w-full max-w-xs rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm outline-none", value: shopId || "", onChange: (e) => {
                                        const val = e.target.value || undefined;
                                        setShopId(val);
                                        if (val)
                                            localStorage.setItem("shopId", val);
                                        else
                                            localStorage.removeItem("shopId");
                                    }, disabled: !shops.length && !loadingShops, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All" }), shops.map((shop) => ((0, jsx_runtime_1.jsxs)("option", { value: shop.id, children: [shop.name, " ", shop.platform ? `(${shop.platform})` : ""] }, shop.id)))] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "kpi-card flex-1 min-w-[140px]", children: [(0, jsx_runtime_1.jsx)("div", { className: "kpi-title", children: "Total products (recent)" }), (0, jsx_runtime_1.jsx)("div", { className: "kpi-value", children: summary ? summary.totalProducts : "-" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "kpi-card flex-1 min-w-[140px]", children: [(0, jsx_runtime_1.jsx)("div", { className: "kpi-title", children: "Total sales (KES)" }), (0, jsx_runtime_1.jsx)("div", { className: "kpi-value", children: summary ? Number(summary.totalSales).toLocaleString() : "-" })] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm opacity-70", children: "Recent uploads" }), (0, jsx_runtime_1.jsx)("div", { className: "sparkline", children: (0, jsx_runtime_1.jsx)(Sparkline_1.default, { values: recentReports.map((r) => r.productsCount), color: "var(--primary)" }) }), (0, jsx_runtime_1.jsx)("div", { className: "w-full sm:w-auto sm:ml-auto", children: (0, jsx_runtime_1.jsx)(Button_1.default, { onClick: () => (window.location.href = "/attendant/daily-report"), variant: "primary", className: "w-full text-center sm:w-auto", children: "Open daily report" }) })] }), loading ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400", children: "Loading your workspace\u2026" })) : shops.length || !loadingShops ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 md:grid-cols-2 lg:grid-cols-[1.2fr_.8fr]", children: [(0, jsx_runtime_1.jsx)("div", { className: "space-y-6", children: widgets.primary.length ? (widgets.primary.map((w) => (0, jsx_runtime_1.jsx)("div", { children: w.node }, w.id))) : ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400", children: "No widgets configured for this category yet." })) }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-6", children: widgets.secondary.length ? widgets.secondary.map((w) => (0, jsx_runtime_1.jsx)("div", { children: w.node }, w.id)) : null })] }), (0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300", children: "Tap any widget card to surface actions, and use the select box above if you need to focus on a single shop." })] })) : ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400", children: "You are not assigned to any active shop yet." }))] }) }));
}
