"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantDashboard;
const react_1 = require("react");
const QueueList_1 = __importDefault(require("./_components/QueueList"));
const QuickPriceCard_1 = __importDefault(require("./_components/QuickPriceCard"));
const ReturnsCard_1 = __importDefault(require("./_components/ReturnsCard"));
const ShopSnapshot_1 = __importDefault(require("./_components/ShopSnapshot"));
const Shortcuts_1 = __importDefault(require("./_components/Shortcuts"));
const Announcement_1 = __importDefault(require("./_components/Announcement"));
const DailySalesCard_1 = __importDefault(require("./_components/DailySalesCard"));
const ProductUploadsCard_1 = __importDefault(require("./_components/ProductUploadsCard"));
const categories_1 = require("@/lib/attendants/categories");
const PRIMARY_WIDGETS = new Set(["QUEUE", "PRICING", "RETURNS", "DAILY_SALES", "PRODUCT_UPLOADS"]);
function renderWidget(widget, shopId) {
    switch (widget) {
        case "QUEUE":
            return <QueueList_1.default shopId={shopId ?? undefined}/>;
        case "PRICING":
            return <QuickPriceCard_1.default />;
        case "RETURNS":
            return <ReturnsCard_1.default />;
        case "SHOP_SNAPSHOT":
            return <ShopSnapshot_1.default shopId={shopId ?? undefined}/>;
        case "SHORTCUTS":
            return <Shortcuts_1.default />;
        case "ANNOUNCEMENTS":
            return <Announcement_1.default />;
        case "DAILY_SALES":
            return <DailySalesCard_1.default />;
        case "PRODUCT_UPLOADS":
            return <ProductUploadsCard_1.default />;
        default:
            return null;
    }
}
function AttendantDashboard() {
    const [shopId, setShopId] = (0, react_1.useState)(undefined);
    const [profile, setProfile] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [shops, setShops] = (0, react_1.useState)([]);
    const [loadingShops, setLoadingShops] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        const saved = typeof window !== "undefined" ? localStorage.getItem("shopId") || undefined : undefined;
        setShopId(saved || undefined);
        void fetchProfile();
        void fetchShops();
    }, []);
    async function fetchProfile() {
        try {
            const res = await fetch("/api/attendants/me", { cache: "no-store" });
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
            const res = await fetch("/api/attendants/shops", { cache: "no-store" });
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
        const fallback = profile?.attendantCategory ?? "GENERAL";
        const raw = profile?.categories ?? [];
        const ordered = [fallback, ...raw].filter(Boolean);
        return Array.from(new Set(ordered));
    }, [profile?.attendantCategory, profile?.categories]);
    const definitions = (0, react_1.useMemo)(() => {
        if (categoryOrder.length) {
            return categoryOrder.map((cat) => categories_1.attendantCategoryById[cat] ?? categories_1.attendantCategoryById.GENERAL);
        }
        return [categories_1.attendantCategoryById.GENERAL];
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
    return (<div className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Attendant Dashboard</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-widest text-slate-300">
            {definitions.map((def, idx) => (<span key={def.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1">
                <span className="font-semibold text-white">{def.label}</span>
                {idx === 0 ? <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-200">Primary</span> : null}
              </span>))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Shop:</span>
          <select className="rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none" value={shopId || ""} onChange={(e) => {
            const val = e.target.value || undefined;
            setShopId(val);
            if (val)
                localStorage.setItem("shopId", val);
            else
                localStorage.removeItem("shopId");
        }} disabled={!shops.length && !loadingShops}>
            <option value="">All</option>
            {shops.map((shop) => (<option key={shop.id} value={shop.id}>
                {shop.name} {shop.platform ? `(${shop.platform})` : ""}
              </option>))}
          </select>
        </div>
      </div>

      {loading ? (<div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
          Loading your workspace…
        </div>) : shops.length || !loadingShops ? (<div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-6">
            {widgets.primary.length ? (widgets.primary.map((w) => <div key={w.id}>{w.node}</div>)) : (<div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                No widgets configured for this category yet.
              </div>)}
          </div>
          <div className="space-y-6">
            {widgets.secondary.length ? widgets.secondary.map((w) => <div key={w.id}>{w.node}</div>) : null}
          </div>
        </div>) : (<div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
          You are not assigned to any active shop yet.
        </div>)}
    </div>);
}
