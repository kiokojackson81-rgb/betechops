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
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
// Switch to API-based KPIs for cross-shop totals
// Keep DB metrics local
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const AutoRefresh_1 = __importDefault(require("@/app/_components/AutoRefresh"));
const KpisRefresher_1 = __importDefault(require("@/app/_components/KpisRefresher"));
exports.dynamic = "force-dynamic";
async function getStats() {
    try {
        const [dbProducts, shops, attendants, returnsDb, revenueAgg] = await Promise.all([
            prisma_1.prisma.product.count(),
            prisma_1.prisma.shop.count(),
            prisma_1.prisma.user.count({ where: { role: { in: ["ATTENDANT", "SUPERVISOR", "ADMIN"] } } }),
            prisma_1.prisma.returnCase.count(),
            prisma_1.prisma.order.aggregate({ _sum: { paidAmount: true } }),
        ]);
        // Cross-shop vendor KPIs (products) and DB-only pending for accuracy
        let kpis = null;
        let kpisDbOnly = null;
        let pendingDiff = null;
        const pendingWindowDays = Number(process.env.JUMIA_PENDING_WINDOW_DAYS ?? 30);
        try {
            const [metricsUrl, metricsDbUrl, diffUrl] = await Promise.all([
                (0, abs_url_1.absUrl)("/api/metrics/kpis"),
                (0, abs_url_1.absUrl)("/api/metrics/kpis?noLive=1&pendingStatuses=PENDING"),
                (0, abs_url_1.absUrl)(`/api/metrics/pending-diff?days=${pendingWindowDays}`),
            ]);
            const [resp, respDb, respDiff] = await Promise.all([
                fetch(metricsUrl, { cache: "no-store" }).catch(() => null),
                fetch(metricsDbUrl, { cache: "no-store" }).catch(() => null),
                fetch(diffUrl, { cache: "no-store" }).catch(() => null),
            ]);
            if (resp && resp.ok)
                kpis = await resp.json();
            if (respDb && respDb.ok)
                kpisDbOnly = await respDb.json();
            if (respDiff && respDiff.ok)
                pendingDiff = await respDiff.json();
        }
        catch {
            kpis = kpisDbOnly = pendingDiff = null;
        }
        const productsAll = typeof kpis?.productsAll === "number" ? Number(kpis.productsAll) : 0;
        const approxProducts = Boolean(kpis?.approx);
        const now = new Date();
        // DB-only pending to avoid live adjustments here; we'll show live separately.
        // Fall back to a direct Prisma count if the API fetch failed (common during cold starts).
        let pendingDb = typeof kpisDbOnly?.pendingAll === "number" ? Number(kpisDbOnly.pendingAll) : null;
        let approxPending = Boolean(kpisDbOnly?.approx);
        if (pendingDb === null) {
            try {
                const DEFAULT_TZ = "Africa/Nairobi";
                const window = Number.isFinite(pendingWindowDays) && pendingWindowDays > 0 ? pendingWindowDays : 30;
                const since = (0, date_fns_tz_1.zonedTimeToUtc)((0, date_fns_1.addDays)(now, -window), DEFAULT_TZ);
                pendingDb = await prisma_1.prisma.jumiaOrder.count({
                    where: {
                        status: { in: ["PENDING"] },
                        OR: [
                            { updatedAtJumia: { gte: since } },
                            { createdAtJumia: { gte: since } },
                            {
                                AND: [
                                    { updatedAtJumia: null },
                                    { createdAtJumia: null },
                                    { updatedAt: { gte: since } },
                                ],
                            },
                        ],
                    },
                });
                approxPending = false;
            }
            catch {
                pendingDb = 0;
            }
        }
        const pendingLive = typeof pendingDiff?.vendor?.pending === "number"
            ? Number(pendingDiff.vendor.pending)
            : typeof kpis?.pendingAll === "number"
                ? Number(kpis.pendingAll)
                : null;
        const vendorShopsActiveJumia = typeof pendingDiff?.vendor?.shopsActiveJumia === "number" ? Number(pendingDiff.vendor.shopsActiveJumia) : null;
        const vendorLastStatus = typeof pendingDiff?.vendor?.lastStatus === "number" ? Number(pendingDiff.vendor.lastStatus) : null;
        const vendorLastError = typeof pendingDiff?.vendor?.lastError === "string" ? String(pendingDiff.vendor.lastError) : null;
        return {
            productsAll,
            productsDb: dbProducts,
            shops,
            attendants,
            pendingDb: pendingDb ?? 0,
            pendingLive,
            vendorShopsActiveJumia,
            vendorLastStatus,
            vendorLastError,
            returnsDb,
            revenue: revenueAgg._sum.paidAmount ?? 0,
            approxProducts,
            approxPending,
        };
    }
    catch {
        return { productsAll: 0, productsDb: 0, shops: 0, attendants: 0, pendingDb: 0, pendingLive: null, returnsDb: 0, revenue: 0, _degraded: true };
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
    const liveSub = (() => {
        if (s.pendingLive == null)
            return "Vendor timed out/error — check API credentials";
        if (s.pendingLive === 0) {
            if (typeof s.vendorShopsActiveJumia === 'number' && s.vendorShopsActiveJumia === 0)
                return "No active JUMIA shops in DB — add shops or set env creds";
            if (typeof s.vendorLastStatus === 'number' && s.vendorLastStatus >= 400)
                return `Vendor ${s.vendorLastStatus} — check credentials`;
        }
        return "Vendor live (timeboxed)";
    })();
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
        <Card title="Pending Orders (DB)" value={s.pendingDb} Icon={lucide_react_1.Receipt} sub={s.approxPending ? "DB exact (windowed)" : "DB exact"}/>
        <Card title="Pending Orders (Live API)" value={s.pendingLive ?? "—"} Icon={lucide_react_1.Receipt} sub={liveSub}/>
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
