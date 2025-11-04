"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PendingPricingDetail;
const prisma_1 = require("@/lib/prisma");
const link_1 = __importDefault(require("next/link"));
const FinalizePricingButton_1 = __importDefault(require("./_actions/FinalizePricingButton"));
function fmtKsh(n) { return `Ksh ${n.toLocaleString()}`; }
async function PendingPricingDetail({ params }) {
    const { id } = await params;
    const order = await prisma_1.prisma.order.findUnique({
        where: { id },
        include: {
            shop: { select: { name: true } },
            items: {
                select: {
                    id: true, quantity: true, sellingPrice: true,
                    product: { select: { name: true, sku: true, sellingPrice: true } },
                },
            },
        },
    });
    if (!order) {
        return (<div className="mx-auto max-w-4xl p-6">
        <p className="text-slate-300">Order not found.</p>
        <link_1.default href="/admin/pending-pricing" className="mt-4 inline-block rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">Back</link_1.default>
      </div>);
    }
    // compute estimated totals
    const rows = order.items.map((it) => {
        const unit = typeof it.sellingPrice === "number" ? it.sellingPrice : (it.product?.sellingPrice ?? 0);
        const sub = unit * it.quantity;
        return { ...it, unit, sub };
    });
    const total = rows.reduce((s, it) => s + it.sub, 0);
    const qty = rows.reduce((s, it) => s + it.quantity, 0);
    return (<div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pending Pricing · {order.orderNumber}</h1>
          <p className="text-slate-400 text-sm">Shop: {order.shop?.name || "—"}</p>
        </div>
        <link_1.default href="/admin/pending-pricing" className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">Back</link_1.default>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-slate-300">
              <th>Product</th><th>SKU</th><th>Qty</th><th>Unit</th><th>Subtotal</th>
            </tr>
          </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((it) => (<tr key={it.id} className="[&>td]:px-3 [&>td]:py-2">
              <td>{it.product?.name || "—"}</td>
              <td className="font-mono">{it.product?.sku || "—"}</td>
              <td>{it.quantity}</td>
              <td>{fmtKsh(it.unit)}</td>
              <td>{fmtKsh(it.sub)}</td>
            </tr>))}
          {rows.length === 0 && (<tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No items.</td></tr>)}
        </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-slate-400">Items</div>
          <div className="mt-1 text-2xl font-semibold">{qty}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-slate-400">Estimated Total</div>
          <div className="mt-1 text-2xl font-semibold">{fmtKsh(total)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-slate-400">Status</div>
          <div className="mt-1 text-2xl font-semibold">{order.status}</div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <FinalizePricingButton_1.default orderId={order.id}/>
      </div>
    </div>);
}
