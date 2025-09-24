import { prisma } from "@/lib/prisma";
import Link from "next/link";
import FinalizePricingButton from "./_actions/FinalizePricingButton";

function fmtKsh(n: number) { return `Ksh ${n.toLocaleString()}`; }

export default async function PendingPricingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      shop: { select: { name: true } },
      items: {
        select: {
          id: true, quantity: true, price: true, subtotal: true,
          product: { select: { name: true, sku: true, sellingPrice: true } },
        },
      },
    },
  });

  if (!order) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-slate-300">Order not found.</p>
        <Link href="/admin/pending-pricing" className="mt-4 inline-block rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">Back</Link>
      </div>
    );
  }

  // compute estimated totals
  const rows = order.items.map((it: { id: string; quantity: number; price?: number | null; subtotal?: number | null; product?: { name?: string | null; sku?: string | null; sellingPrice?: number | null } | null }) => {
    const unit = typeof it.price === "number" ? it.price : (it.product?.sellingPrice ?? 0);
    const sub  = typeof it.subtotal === "number" ? it.subtotal : unit * it.quantity;
    return { ...it, unit, sub };
  });
  const total = rows.reduce((s: number, it: { sub: number }) => s + it.sub, 0);
  const qty = rows.reduce((s: number, it: { quantity: number }) => s + it.quantity, 0);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pending Pricing · {order.orderNumber}</h1>
          <p className="text-slate-400 text-sm">Shop: {order.shop?.name || "—"}</p>
        </div>
        <Link href="/admin/pending-pricing" className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">Back</Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-slate-300">
              <th>Product</th><th>SKU</th><th>Qty</th><th>Unit</th><th>Subtotal</th>
            </tr>
          </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((it: { id: string; quantity: number; unit: number; sub: number; product?: { name?: string | null; sku?: string | null } | null }) => (
            <tr key={it.id} className="[&>td]:px-3 [&>td]:py-2">
              <td>{it.product?.name || "—"}</td>
              <td className="font-mono">{it.product?.sku || "—"}</td>
              <td>{it.quantity}</td>
              <td>{fmtKsh(it.unit)}</td>
              <td>{fmtKsh(it.sub)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No items.</td></tr>
          )}
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
        <FinalizePricingButton orderId={order.id} />
      </div>
    </div>
  );
}