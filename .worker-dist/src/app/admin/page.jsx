"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = Overview;
// app/admin/page.tsx — unified admin console
const prisma_1 = require("@/lib/prisma");
const abs_url_1 = require("@/lib/abs-url");
// Switch to API-based KPIs for cross-shop totals
// Keep DB metrics local
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const AutoRefresh_1 = __importDefault(require("@/app/_components/AutoRefresh"));
const KpisRefresher_1 = __importDefault(require("@/app/_components/KpisRefresher"));
exports.dynamic = "force-dynamic";
async function getStats() {
    var _a;
    try {
        const [dbProducts, shops, attendants, returnsDb, revenueAgg] = await Promise.all([
            prisma_1.prisma.product.count(),
            prisma_1.prisma.shop.count(),
            prisma_1.prisma.user.count({ where: { role: { in: ["ATTENDANT", "SUPERVISOR", "ADMIN"] } } }),
            prisma_1.prisma.returnCase.count(),
            prisma_1.prisma.order.aggregate({ _sum: { paidAmount: true } }),
        ]);
        let kpis = null;
        try {
            const metricsUrl = await (0, abs_url_1.absUrl)("/api/metrics/kpis");
            const resp = await fetch(metricsUrl, { cache: "no-store" });
            if (resp.ok)
                kpis = await resp.json();
        }
        catch (_b) {
            kpis = null;
        }
        let productsAll = typeof (kpis === null || kpis === void 0 ? void 0 : kpis.productsAll) === "number" ? Number(kpis.productsAll) : 0;
        const approxProducts = Boolean(kpis === null || kpis === void 0 ? void 0 : kpis.approx);
        // Use cross-shop persisted KPI for Pending orders only (no local DB sum)
        // This avoids flicker and double counting.
        let pendingAll = typeof (kpis === null || kpis === void 0 ? void 0 : kpis.pendingAll) === "number" ? Number(kpis.pendingAll) : 0;
        let approxPending = Boolean(kpis === null || kpis === void 0 ? void 0 : kpis.approx);
        return {
            productsAll,
            productsDb: dbProducts,
            shops,
            attendants,
            pendingAll,
            returnsDb,
            revenue: (_a = revenueAgg._sum.paidAmount) !== null && _a !== void 0 ? _a : 0,
            approxProducts,
            approxPending,
        };
    }
    catch (_c) {
        return { productsAll: 0, productsDb: 0, shops: 0, attendants: 0, pendingAll: 0, returnsDb: 0, revenue: 0, _degraded: true };
    }
}
function Card({ title, value, Icon, sub }) {
    return (<div className="rounded-2xl border border-white/10 bg-[var(--card,#171b23)] p-5">
      <div className="flex items-center gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-2"><Icon className="h-5 w-5"/></div>
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
        </div>
      </div>
    </div>);
}
async function Overview() {
    const s = await getStats();
    return (<div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Overview</h1>
      <AutoRefresh_1.default intervalMs={60000}/>
      {/* Trigger an exact refresh once if we only have approximate totals */}
      {(s.approxProducts || s.approxPending) && <KpisRefresher_1.default enabled={true}/>}
      {"_degraded" in s && (<div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-200">
          DB unavailable or migrations missing. See Admin → Health Checks.
        </div>)}

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card title="Vendor Products (All)" value={s.productsAll} Icon={lucide_react_1.Package} sub={s.approxProducts ? "Approx (bounded scan)" : undefined}/>
        <Card title="Shops" value={s.shops} Icon={lucide_react_1.Store}/>
        <Card title="Attendants" value={s.attendants} Icon={lucide_react_1.Users}/>
        <Card title="Pending Orders (All)" value={s.pendingAll} Icon={lucide_react_1.Receipt} sub={s.approxPending ? "Live vendor count (DB sync pending)" : undefined}/>
        <Card title="Revenue (paid)" value={`Ksh ${s.revenue.toLocaleString()}`} Icon={lucide_react_1.Wallet} sub="Sum of paid amounts"/>
      </section>

      <div className="text-xs text-slate-400">Local DB: Products {s.productsDb}, Returns {s.returnsDb}</div>

      {/* Quick pivots */}
      <section className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 p-4 bg-[var(--panel,#121723)]">
          <h2 className="font-semibold mb-2">Today</h2>
          <ul className="text-slate-300 space-y-1 text-sm list-disc ml-5">
            <li><link_1.default className="underline" href="/admin/orders?status=PENDING&shopId=ALL">Pending orders</link_1.default></li>
            <li><link_1.default className="underline" href="/admin/pending-pricing">Pending pricing</link_1.default></li>
            <li><link_1.default className="underline" href="/admin/returns">Returns waiting pickup</link_1.default></li>
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 p-4 bg-[var(--panel,#121723)]">
          <h2 className="font-semibold mb-2">Catalog Actions</h2>
          <ul className="text-slate-300 space-y-1 text-sm list-disc ml-5">
            <li><link_1.default className="underline" href="/admin/catalog/feeds/create">Create products feed</link_1.default></li>
            <li><link_1.default className="underline" href="/admin/catalog/feeds/price">Price update feed</link_1.default></li>
            <li><link_1.default className="underline" href="/admin/catalog/feeds/stock">Stock update feed</link_1.default></li>
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 p-4 bg-[var(--panel,#121723)]">
          <h2 className="font-semibold mb-2">Shops & Staff</h2>
          <ul className="text-slate-300 space-y-1 text-sm list-disc ml-5">
            <li><link_1.default className="underline" href="/admin/shops">Create shops, assign attendants/supervisors</link_1.default></li>
            <li><link_1.default className="underline" href="/admin/settings">API credentials</link_1.default></li>
          </ul>
        </div>
      </section>
    </div>);
}
