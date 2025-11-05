// app/admin/page.tsx — unified admin console
import { prisma } from "@/lib/prisma";
import { absUrl } from "@/lib/abs-url";
// Switch to API-based KPIs for cross-shop totals
// Keep DB metrics local
import Link from "next/link";
import { Package, Store, Users, Receipt, Wallet } from "lucide-react";
import AutoRefresh from "@/app/_components/AutoRefresh";
import KpisRefresher from "@/app/_components/KpisRefresher";

export const dynamic = "force-dynamic";

type Stats = {
  productsAll: number;
  shops: number;
  attendants: number;
  pendingDb: number;
  pendingLive: number | null;
  vendorShopsActiveJumia?: number | null;
  vendorLastStatus?: number | null;
  vendorLastError?: string | null;
  revenue: number;
  productsDb: number;
  returnsDb: number;
} & Partial<{ _degraded: true; approxProducts: boolean; approxPending: boolean }>;

async function getStats(): Promise<Stats> {
  try {
    const [dbProducts, shops, attendants, returnsDb, revenueAgg] = await Promise.all([
      prisma.product.count(),
      prisma.shop.count(),
      prisma.user.count({ where: { role: { in: ["ATTENDANT", "SUPERVISOR", "ADMIN"] } } }),
      prisma.returnCase.count(),
      prisma.order.aggregate({ _sum: { paidAmount: true } }),
    ]);

    // Cross-shop vendor KPIs (products) and DB-only pending for accuracy
    let kpis: any = null;
    let kpisDbOnly: any = null;
    let pendingDiff: any = null;
    const pendingWindowDays = Number(process.env.JUMIA_PENDING_WINDOW_DAYS ?? 30);
    try {
      const [metricsUrl, metricsDbUrl, diffUrl] = await Promise.all([
        absUrl("/api/metrics/kpis"),
        absUrl("/api/metrics/kpis?noLive=1&pendingStatuses=PENDING"),
        absUrl(`/api/metrics/pending-diff?days=${pendingWindowDays}`),
      ]);
      const [resp, respDb, respDiff] = await Promise.all([
        fetch(metricsUrl, { cache: "no-store" }).catch(() => null),
        fetch(metricsDbUrl, { cache: "no-store" }).catch(() => null),
        fetch(diffUrl, { cache: "no-store" }).catch(() => null),
      ]);
      if (resp && resp.ok) kpis = await resp.json();
      if (respDb && respDb.ok) kpisDbOnly = await respDb.json();
      if (respDiff && respDiff.ok) pendingDiff = await respDiff.json();
    } catch {
      kpis = kpisDbOnly = pendingDiff = null;
    }

    const productsAll = typeof kpis?.productsAll === "number" ? Number(kpis.productsAll) : 0;
    const approxProducts = Boolean(kpis?.approx);

    // DB-only pending to avoid live adjustments here; we'll show live separately
    const pendingDb = typeof kpisDbOnly?.pendingAll === "number" ? Number(kpisDbOnly.pendingAll) : 0;
    const approxPending = Boolean(kpisDbOnly?.approx);
    const pendingLive = typeof pendingDiff?.vendor?.pending === "number" ? Number(pendingDiff.vendor.pending) : null;
    const vendorShopsActiveJumia = typeof pendingDiff?.vendor?.shopsActiveJumia === "number" ? Number(pendingDiff.vendor.shopsActiveJumia) : null;
    const vendorLastStatus = typeof pendingDiff?.vendor?.lastStatus === "number" ? Number(pendingDiff.vendor.lastStatus) : null;
    const vendorLastError = typeof pendingDiff?.vendor?.lastError === "string" ? String(pendingDiff.vendor.lastError) : null;

    return {
      productsAll,
      productsDb: dbProducts,
      shops,
      attendants,
      pendingDb,
      pendingLive,
      vendorShopsActiveJumia,
      vendorLastStatus,
      vendorLastError,
      returnsDb,
      revenue: revenueAgg._sum.paidAmount ?? 0,
      approxProducts,
      approxPending,
    };
  } catch {
    return { productsAll: 0, productsDb: 0, shops: 0, attendants: 0, pendingDb: 0, pendingLive: null, returnsDb: 0, revenue: 0, _degraded: true as const };
  }
}

function Card({ title, value, Icon, sub }: { title: string; value: string | number; Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { className?: string }>; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--card,#171b23)] p-5">
      <div className="flex items-center gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-2"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default async function Overview() {
  const s = await getStats();
  const liveSub = (() => {
    if (s.pendingLive == null) return "Vendor timed out/error — check API credentials";
    if (s.pendingLive === 0) {
      if (typeof s.vendorShopsActiveJumia === 'number' && s.vendorShopsActiveJumia === 0) return "No active JUMIA shops in DB — add shops or set env creds";
      if (typeof s.vendorLastStatus === 'number' && s.vendorLastStatus >= 400) return `Vendor ${s.vendorLastStatus} — check credentials`;
    }
    return "Vendor live (timeboxed)";
  })();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Overview</h1>
      <AutoRefresh intervalMs={60_000} />
      {/* Trigger an exact refresh once if we only have approximate totals */}
      {(s.approxProducts || s.approxPending) && <KpisRefresher enabled={true} />}
      {"_degraded" in s && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-200">
          DB unavailable or migrations missing. See Admin → Health Checks.
        </div>
      )}

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card title="Vendor Products (All)" value={s.productsAll} Icon={Package} sub={s.approxProducts ? "Approx (bounded scan)" : undefined} />
        <Card title="Shops" value={s.shops} Icon={Store} />
        <Card title="Attendants" value={s.attendants} Icon={Users} />
        <Card
          title="Pending Orders (DB)"
          value={s.pendingDb}
          Icon={Receipt}
          sub={s.approxPending ? "DB exact (windowed)" : "DB exact"}
        />
        <Card
          title="Pending Orders (Live API)"
          value={s.pendingLive ?? "—"}
          Icon={Receipt}
          sub={liveSub}
        />
        <Card title="Revenue (paid)" value={`Ksh ${s.revenue.toLocaleString()}`} Icon={Wallet} sub="Sum of paid amounts" />
      </section>

      <div className="text-xs text-slate-400">Local DB: Products {s.productsDb}, Returns {s.returnsDb}</div>

      {/* Quick pivots */}
      <section className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 p-4 bg-[var(--panel,#121723)]">
          <h2 className="font-semibold mb-2">Today</h2>
          <ul className="text-slate-300 space-y-1 text-sm list-disc ml-5">
            <li><Link className="underline" href="/admin/orders?status=PENDING&shopId=ALL">Pending orders</Link></li>
            <li><Link className="underline" href="/admin/pending-pricing">Pending pricing</Link></li>
            <li><Link className="underline" href="/admin/returns">Returns waiting pickup</Link></li>
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 p-4 bg-[var(--panel,#121723)]">
          <h2 className="font-semibold mb-2">Catalog Actions</h2>
          <ul className="text-slate-300 space-y-1 text-sm list-disc ml-5">
            <li><Link className="underline" href="/admin/catalog/feeds/create">Create products feed</Link></li>
            <li><Link className="underline" href="/admin/catalog/feeds/price">Price update feed</Link></li>
            <li><Link className="underline" href="/admin/catalog/feeds/stock">Stock update feed</Link></li>
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 p-4 bg-[var(--panel,#121723)]">
          <h2 className="font-semibold mb-2">Shops & Staff</h2>
          <ul className="text-slate-300 space-y-1 text-sm list-disc ml-5">
            <li><Link className="underline" href="/admin/shops">Create shops, assign attendants/supervisors</Link></li>
            <li><Link className="underline" href="/admin/settings">API credentials</Link></li>
          </ul>
        </div>
      </section>
    </div>
  );
}
