// src/app/admin/pending-pricing/page.tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const PAGE_SIZE_DEFAULT = 10;

function fmtKsh(n: number) {
  return `Ksh ${n.toLocaleString()}`;
}
function fmtDate(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}
function buildWhere(q?: string) {
  if (!q) return { status: "PENDING" as const };
  return {
    status: "PENDING" as const,
    OR: [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q, mode: "insensitive" } },
      { shop: { name: { contains: q, mode: "insensitive" } } },
    ],
  };
}

export default async function PendingPricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; q?: string; size?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page || 1));
  const size = Math.min(50, Math.max(1, Number(params?.size || PAGE_SIZE_DEFAULT)));
  const q = (params?.q || "").trim() || undefined;

  const where = buildWhere(q);

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * size,
      take: size,
      include: {
        shop: { select: { name: true } },
        items: {
          select: { quantity: true, price: true, subtotal: true, product: { select: { name: true, sku: true, sellingPrice: true } } },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / size));

  // Compute derived totals
  const calcTotals = (items: unknown[]) => {
    const qty = items.reduce((n: number, it: unknown) => n + (it as { quantity: number }).quantity, 0);
    // If `subtotal` missing, fallback to product.sellingPrice * qty
    const subtotal = items.reduce((sum: number, it: unknown) => {
      const item = it as { quantity: number; subtotal?: number; product?: { sellingPrice?: number } };
      const fallback = (item.product?.sellingPrice ?? 0) * item.quantity;
      const val = typeof item.subtotal === "number" ? item.subtotal : fallback;
      return sum + val;
    }, 0);
    return { qty, subtotal };
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pending Pricing</h1>
          <p className="text-slate-400 text-sm">Orders that need price verification or completion.</p>
        </div>
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={q || ""}
            placeholder="Search order #, name, phone, shop…"
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:bg-white/10"
          />
          <select name="size" defaultValue={String(size)} className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-sm">
            {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
          <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10">Apply</button>
        </form>
      </header>

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
            {rows.map((o: unknown) => {
              const order = o as { id: string; orderNumber: string; customerName: string; customerPhone?: string; customerEmail?: string; createdAt: Date; shop?: { name?: string }; items: unknown[] };
              const { qty, subtotal } = calcTotals(order.items);
              return (
                <tr key={order.id} className="[&>td]:px-3 [&>td]:py-3">
                  <td className="font-mono">{order.orderNumber}</td>
                  <td>
                    <div className="font-medium">{order.customerName}</div>
                    <div className="text-slate-400">{order.customerPhone || order.customerEmail || "—"}</div>
                  </td>
                  <td>{order.shop?.name || "—"}</td>
                  <td>{qty}</td>
                  <td>{fmtKsh(subtotal)}</td>
                  <td>{fmtDate(order.createdAt)}</td>
                  <td className="text-right">
                    <Link
                      href={`/admin/pending-pricing/${order.id}`}
                      className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  Nothing pending pricing.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
        <div>
          Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span> • {total} total
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/pending-pricing?${new URLSearchParams({ q: q || "", size: String(size), page: String(Math.max(1, page - 1)) }).toString()}`}
            className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10"
          >
            Prev
          </Link>
          <Link
            href={`/admin/pending-pricing?${new URLSearchParams({ q: q || "", size: String(size), page: String(Math.min(totalPages, page + 1)) }).toString()}`}
            className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10"
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}