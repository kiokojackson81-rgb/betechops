import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ActionMarkPicked from "./_actions/ActionMarkPicked";

function fmtKsh(n: number) {
  return `Ksh ${n.toLocaleString()}`;
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function statusLabel(status: string, pickedAt: Date | null) {
  if (status === "picked_up" || pickedAt) return "Picked up";
  if (status === "pickup_scheduled") return "Waiting pickup";
  return status.replace(/_/g, " ");
}

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ret = await prisma.returnCase.findUnique({
    where: { id },
    include: {
      shop: { select: { name: true, location: true } },
      order: {
        include: {
          shop: { select: { name: true, location: true } },
          attendant: { select: { name: true, email: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              sellingPrice: true,
              product: { select: { name: true, sku: true, sellingPrice: true, lastBuyingPrice: true } },
            },
          },
        },
      },
    },
  });

  if (!ret || !ret.order) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-slate-300">Return not found.</p>
        <Link href="/admin/returns" className="mt-4 inline-block rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">
          Back
        </Link>
      </div>
    );
  }

  const order = ret.order;
  const qty = order.items.reduce((n, it) => n + it.quantity, 0);
  const total = order.items.reduce((sum, it) => sum + ((it.sellingPrice ?? it.product?.sellingPrice ?? 0) * it.quantity), 0);
  const cost = order.items.reduce((sum, it) => sum + ((it.product?.lastBuyingPrice ?? 0) * it.quantity), 0);
  const gross = total - cost;
  const picked = ret.status === "picked_up" || Boolean(ret.pickedAt);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Return • {order.orderNumber || ret.id}</h1>
          <p className="text-slate-400 text-sm">
            {statusLabel(ret.status, ret.pickedAt)} • Created {fmtDate(ret.createdAt)}
          </p>
        </div>
        <Link href="/admin/returns" className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">
          Back
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-slate-400">Customer</div>
          <div className="mt-1 font-medium">{order.customerName || "—"}</div>
          <div className="text-slate-400 text-sm">{order.customerName || "—"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-slate-400">Shop</div>
          <div className="mt-1 font-medium">{ret.shop?.name || order.shop?.name || "—"}</div>
          <div className="text-slate-400 text-sm">{ret.shop?.location || order.shop?.location || "—"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-slate-400">Attendant</div>
          <div className="mt-1 font-medium">{order.attendant?.name || "—"}</div>
          <div className="text-slate-400 text-sm">{order.attendant?.email || "—"}</div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-slate-300">
              <th>Product</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {order.items.map((it) => {
              const unit = it.sellingPrice ?? it.product?.sellingPrice ?? 0;
              const sub = unit * it.quantity;
              return (
                <tr key={it.id} className="[&>td]:px-3 [&>td]:py-2">
                  <td>{it.product?.name || "—"}</td>
                  <td className="font-mono">{it.product?.sku || "—"}</td>
                  <td>{it.quantity}</td>
                  <td>{fmtKsh(unit)}</td>
                  <td>{fmtKsh(sub)}</td>
                </tr>
              );
            })}
            {order.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                  No items.
                </td>
              </tr>
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
          <div className="text-sm text-slate-400">Total</div>
          <div className="mt-1 text-2xl font-semibold">{fmtKsh(total)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-slate-400">Gross Profit</div>
          <div className="mt-1 text-2xl font-semibold">{fmtKsh(gross)}</div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <ActionMarkPicked returnId={ret.id} disabled={picked} />
      </div>
    </div>
  );
}
