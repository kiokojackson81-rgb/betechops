"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = AdminDashboard;
const prisma_1 = require("@/lib/prisma");
const lucide_react_1 = require("lucide-react");
// Opt out of prerendering; this page hits the DB
exports.dynamic = "force-dynamic";
async function getStats() {
    try {
        const [products, shops, attendants, orders, revenueAgg] = await Promise.all([
            prisma_1.prisma.product.count(),
            prisma_1.prisma.shop.count(),
            prisma_1.prisma.user.count({ where: { role: { in: ["ATTENDANT", "SUPERVISOR", "ADMIN"] } } }),
            prisma_1.prisma.order.count(),
            prisma_1.prisma.order.aggregate({ _sum: { paidAmount: true } }),
        ]);
        return {
            products,
            shops,
            attendants,
            orders,
            revenue: revenueAgg._sum.paidAmount ?? 0,
        };
    }
    catch (e) {
        // Graceful fallback when DB is unavailable/misconfigured
        console.error("Admin dashboard getStats failed:", e);
        return {
            products: 0,
            shops: 0,
            attendants: 0,
            orders: 0,
            revenue: 0,
            // mark that data is degraded
            _degraded: true,
        };
    }
}
function StatCard(props) {
    const { title, value, Icon, sub } = props;
    return (<div className="rounded-2xl border border-white/10 bg-[var(--card,#23272f)] p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-2">
          <Icon className="h-5 w-5"/>
        </div>
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          {sub ? <p className="text-slate-400 text-xs mt-1">{sub}</p> : null}
        </div>
      </div>
    </div>);
}
async function AdminDashboard() {
    const stats = await getStats();
    const { products, shops, attendants, orders, revenue } = stats;
    return (<div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-slate-300">Live metrics from your Prisma database.</p>
        {"_degraded" in stats && (<div className="mt-4 flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-200">
            <lucide_react_1.AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/>
            <div>
              <p className="font-medium">Database is unavailable or misconfigured.</p>
              <p className="text-sm opacity-90">
                Counts are shown as 0 for now. Verify DATABASE_URL and run migrations. See Admin → Health Checks.
              </p>
            </div>
          </div>)}
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <StatCard title="Products" value={products} Icon={lucide_react_1.Package}/>
        <StatCard title="Shops" value={shops} Icon={lucide_react_1.Store}/>
        <StatCard title="Attendants" value={attendants} Icon={lucide_react_1.Users}/>
        <StatCard title="Orders" value={orders} Icon={lucide_react_1.Receipt}/>
        <StatCard title="Revenue (paid)" value={`Ksh ${revenue.toLocaleString()}`} Icon={lucide_react_1.Wallet} sub="Sum of paid amounts"/>
      </section>

      <div className="mt-8 text-sm text-slate-400 space-y-1">
        <p>
          Tip: seed more data with <code className="bg-white/10 px-1 py-0.5 rounded">npm run prisma:seed</code> and refresh.
        </p>
        <p>
          Troubleshooting: visit <a className="underline" href="/admin/health-checks">Admin → Health Checks</a> to verify DB and OIDC.
        </p>
      </div>
    </div>);
}
