"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PendingPricingPage;
// src/app/admin/pending-pricing/page.tsx
const prisma_1 = require("@/lib/prisma");
const scope_1 = require("@/lib/scope");
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const PAGE_SIZE_DEFAULT = 10;
function fmtKsh(n) {
    return `Ksh ${n.toLocaleString()}`;
}
function fmtDate(d) {
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
    }).format(d);
}
function buildWhere(q) {
    const base = { status: "PENDING" };
    if (!q)
        return base;
    return Object.assign(Object.assign({}, base), { OR: [
            { orderNumber: { contains: q } },
            { customerName: { contains: q } },
            { shop: { is: { name: { contains: q } } } },
        ] });
}
async function PendingPricingPage({ searchParams, }) {
    const params = await searchParams;
    const scope = await (0, scope_1.resolveShopScopeForServer)();
    const page = Math.max(1, Number((params === null || params === void 0 ? void 0 : params.page) || 1));
    const size = Math.min(50, Math.max(1, Number((params === null || params === void 0 ? void 0 : params.size) || PAGE_SIZE_DEFAULT)));
    const q = ((params === null || params === void 0 ? void 0 : params.q) || "").trim() || undefined;
    const whereBase = buildWhere(q);
    const where = (scope.shopIds && scope.shopIds.length > 0)
        ? (Object.assign(Object.assign({}, whereBase), { shopId: { in: scope.shopIds } }))
        : whereBase;
    let degraded = false;
    let total = 0;
    let rows = [];
    try {
        [total, rows] = await Promise.all([
            prisma_1.prisma.order.count({ where }),
            prisma_1.prisma.order.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * size,
                take: size,
                include: {
                    shop: { select: { name: true } },
                    items: {
                        select: { quantity: true, sellingPrice: true, product: { select: { name: true, sku: true, sellingPrice: true } } },
                    },
                },
            }),
        ]);
    }
    catch (e) {
        console.error("PendingPricingPage DB error:", e);
        degraded = true;
    }
    const totalPages = Math.max(1, Math.ceil(total / size));
    // Compute derived totals
    const calcTotals = (items) => {
        const qty = items.reduce((n, it) => n + it.quantity, 0);
        // Compute subtotal from sellingPrice (item.sellingPrice || product.sellingPrice)
        const subtotal = items.reduce((sum, it) => {
            var _a, _b, _c;
            const item = it;
            const unit = ((_c = (_a = item.sellingPrice) !== null && _a !== void 0 ? _a : (_b = item.product) === null || _b === void 0 ? void 0 : _b.sellingPrice) !== null && _c !== void 0 ? _c : 0);
            return sum + unit * item.quantity;
        }, 0);
        return { qty, subtotal };
    };
    return (<div className="mx-auto max-w-7xl p-6">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pending Pricing</h1>
          <p className="text-slate-400 text-sm">Orders that need price verification or completion.</p>
        </div>
        <form className="flex items-center gap-2">
          <input name="q" defaultValue={q || ""} placeholder="Search order #, name, shop…" className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:bg-white/10"/>
          <select name="size" defaultValue={String(size)} className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-sm">
            {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
          <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10">Apply</button>
        </form>
      </header>

      {degraded && (<div className="mb-4 flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-200">
          <lucide_react_1.AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/>
          <div>
            <p className="font-medium">Database is unavailable or misconfigured.</p>
            <p className="text-sm opacity-90">Showing 0 results. Check DATABASE_URL and migrations. See Admin → Health Checks.</p>
          </div>
        </div>)}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-slate-300">
              <th>Order #</th>
              <th>Customer</th>
              <th>Shop</th>
              <th>Qty</th>
              <th>Est. Total</th>
              <th>Created</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((o) => {
            var _a;
            const order = o;
            const { qty, subtotal } = calcTotals(order.items);
            return (<tr key={order.id} className="[&>td]:px-3 [&>td]:py-3">
                  <td className="font-mono">{order.orderNumber}</td>
                  <td>
                    <div className="font-medium">{order.customerName}</div>
                  </td>
                  <td>{((_a = order.shop) === null || _a === void 0 ? void 0 : _a.name) || "—"}</td>
                  <td>{qty}</td>
                  <td>{fmtKsh(subtotal)}</td>
                  <td>{fmtDate(order.createdAt)}</td>
                  <td className="text-right">
                    <link_1.default href={`/admin/pending-pricing/${order.id}`} className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">
                      Review
                    </link_1.default>
                  </td>
                </tr>);
        })}
            {rows.length === 0 && (<tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  Nothing pending pricing.
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
        <div>
          Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span> • {total} total
        </div>
        <div className="flex gap-2">
          <link_1.default href={`/admin/pending-pricing?${new URLSearchParams({ q: q || "", size: String(size), page: String(Math.max(1, page - 1)) }).toString()}`} className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">
            Prev
          </link_1.default>
          <link_1.default href={`/admin/pending-pricing?${new URLSearchParams({ q: q || "", size: String(size), page: String(Math.min(totalPages, page + 1)) }).toString()}`} className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">
            Next
          </link_1.default>
        </div>
      </div>
    </div>);
}
