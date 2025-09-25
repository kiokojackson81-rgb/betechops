// src/app/admin/returns/page.tsx
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

// Build Prisma where from query
function buildWhere(q: string | undefined) {
  if (!q) return { status: "CANCELED" as const };
  // Match on orderNumber, customerName, shop name and use CANCELED as proxy
  return {
    status: "CANCELED" as const,
    OR: [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { shop: { name: { contains: q, mode: "insensitive" } } },
    ],
  };
}

export default async function ReturnsPage({
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
          select: { quantity: true, sellingPrice: true, product: { select: { name: true, sku: true } } },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Returns – Waiting Pickup</h1>
          <p className="text-slate-400 text-sm">Orders marked <span className="font-mono">CANCELED</span> (proxy for returns) and pending pickup.</p>
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
              <th>Items</th>
              <th>Paid</th>
              <th>Created</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((o: unknown) => {
              const order = o as { id: string; orderNumber: string; customerName: string; customerPhone?: string; customerEmail?: string; createdAt: Date; paidAmount: number; shop?: { name?: string }; items: { quantity: number }[] };
              const itemsCount = order.items.reduce((n: number, it: { quantity: number }) => n + it.quantity, 0);
              return (
                <tr key={order.id} className="[&>td]:px-3 [&>td]:py-3">
                  <td className="font-mono">{order.orderNumber}</td>
                  <td>
                    <div className="font-medium">{order.customerName}</div>
                    <div className="text-slate-400">{order.customerPhone || order.customerEmail || "—"}</div>
                  </td>
                  <td>{order.shop?.name || "—"}</td>
                  <td>{itemsCount}</td>
                  <td>{fmtKsh(order.paidAmount)}</td>
                  <td>{fmtDate(order.createdAt)}</td>
                  <td className="text-right">
                    <Link
                      href={`/admin/returns/${order.id}`}
                      className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  No returns found.
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
            href={`/admin/returns?${new URLSearchParams({ q: q || "", size: String(size), page: String(Math.max(1, page - 1)) }).toString()}`}
            className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10"
          >
            Prev
          </Link>
          <Link
            href={`/admin/returns?${new URLSearchParams({ q: q || "", size: String(size), page: String(Math.min(totalPages, page + 1)) }).toString()}`}
            className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10"
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}