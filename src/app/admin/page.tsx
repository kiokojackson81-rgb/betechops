// app/admin/page.tsx — unified admin console
import { prisma } from "@/lib/prisma";
import { getCatalogProductsCountQuick, getCatalogProductsCountQuickForShop, getPendingOrdersCountQuickForShop } from "@/lib/jumia";
import { readKpisCache } from "@/lib/kpisCache";
import { updateKpisCache, updateKpisCacheExact } from "@/lib/jobs/kpis";
import Link from "next/link";
import { Package, Store, Users, Receipt, Wallet } from "lucide-react";
import AutoRefresh from "@/app/_components/AutoRefresh";
import KpisRefresher from "@/app/_components/KpisRefresher";

export const dynamic = "force-dynamic";

type Stats = { productsAll: number; shops: number; attendants: number; pendingAll: number; revenue: number; productsDb: number; returnsDb: number } & Partial<{ _degraded: true; approx: boolean }>;

async function getStats(): Promise<Stats> {
  try {
    const [dbProducts, shops, attendants, returnsDb, revenueAgg, vendorCount, shopList, cached] = await Promise.all([
      prisma.product.count(),
      prisma.shop.count(),
      prisma.user.count({ where: { role: { in: ["ATTENDANT", "SUPERVISOR", "ADMIN"] } } }),
      prisma.returnCase.count(),
      prisma.order.aggregate({ _sum: { paidAmount: true } }),
      // vendor products quick count (bounded)
      getCatalogProductsCountQuick({ limitPages: 3, size: 100, timeMs: 6000 }).catch(() => ({ total: 0 } as any)),
      prisma.shop.findMany({ where: { isActive: true, platform: 'JUMIA' }, select: { id: true } }),
      readKpisCache().catch(() => null),
    ]);
    // Prefer cached cross-shop totals when available; refresh cache in background if stale/missing
    if (!cached) {
      // fire and forget; do not await
      void updateKpisCache().catch(() => undefined);
    }
    // If cached exists but is approximate, trigger an exact refresh in the background
    if (cached?.approx) {
      void updateKpisCacheExact().catch(() => undefined);
    }
    // Aggregate across all Jumia shops (bounded counters)
    const perShop = await Promise.all(
      shopList.map(async (s) => ({
        prod: await getCatalogProductsCountQuickForShop({ shopId: s.id, limitPages: 2, size: 100, timeMs: 5000 }).catch(() => ({ total: 0, approx: true })),
        pend: await getPendingOrdersCountQuickForShop({ shopId: s.id, limitPages: 2, size: 50, timeMs: 5000 }).catch(() => ({ total: 0, approx: true })),
      }))
    );
    // If cache exists, use it; otherwise use bounded per-shop scans
    const productsAll = (cached?.productsAll ?? 0) || perShop.reduce((sum, r) => sum + (r.prod?.total || 0), 0) || (vendorCount as any)?.total || dbProducts;
    const pendingAll = (cached?.pendingAll ?? 0) || perShop.reduce((sum, r) => sum + (r.pend?.total || 0), 0);
    const approx = Boolean(cached?.approx) || perShop.some((r) => r.prod?.approx || r.pend?.approx);
    return { productsAll, productsDb: dbProducts, shops, attendants, pendingAll, returnsDb, revenue: (revenueAgg._sum.paidAmount ?? 0), approx };
  } catch {
    return { productsAll: 0, productsDb: 0, shops: 0, attendants: 0, pendingAll: 0, returnsDb: 0, revenue: 0, _degraded: true as const };
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
  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Overview</h1>
      <AutoRefresh intervalMs={60_000} />
      {/* Trigger an exact refresh once if we only have approximate totals */}
      {s.approx && <KpisRefresher enabled={true} />}
      {"_degraded" in s && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-200">
          DB unavailable or migrations missing. See Admin → Health Checks.
        </div>
      )}

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card title="Vendor Products (All)" value={s.productsAll} Icon={Package} sub={s.approx ? "Approx (bounded scan)" : undefined} />
        <Card title="Shops" value={s.shops} Icon={Store} />
        <Card title="Attendants" value={s.attendants} Icon={Users} />
        <Card title="Pending Orders (All)" value={s.pendingAll} Icon={Receipt} sub={s.approx ? "Approx (bounded scan)" : undefined} />
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