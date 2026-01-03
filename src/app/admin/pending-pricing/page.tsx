// src/app/admin/pending-pricing/page.tsx
import { prisma } from "@/lib/prisma";
import { resolveShopScopeForServer } from "@/lib/scope";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import WeeklySummary from "./WeeklySummary";
import UnpricedOrdersClient from "./UnpricedOrdersClient";
import { AlertTriangle } from "lucide-react";

export default async function PendingPricingPage() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <WeeklySummary />
      </div>
      <div className="mb-6">
        <UnpricedOrdersClient />
      </div>
    </div>
  );
}

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Marketplace weekly summary */}
      <div className="mb-6">
        <WeeklySummary />
      </div>
      {/* Marketplace unpriced orders */}
      <div className="mb-6">
        <UnpricedOrdersClient />
      </div>
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pending Pricing</h1>
          <p className="text-slate-400 text-sm">Orders that need price verification or completion.</p>
        </div>
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={q || ""}
            placeholder="Search order #, name, shop…"
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:bg-white/10"
          />
          <select name="size" defaultValue={String(size)} className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-sm">
            {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
          <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10">Apply</button>
        </form>
      </header>

      {degraded && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Database is unavailable or misconfigured.</p>
            <p className="text-sm opacity-90">Showing 0 results. Check DATABASE_URL and migrations. See Admin → Health Checks.</p>
          </div>
        </div>
      )}

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
              const order = o as { id: string; orderNumber: string; customerName: string; createdAt: Date; shop?: { name?: string }; items: unknown[] };
              const { qty, subtotal } = calcTotals(order.items);
              return (
                <tr key={order.id} className="[&>td]:px-3 [&>td]:py-3">
                  <td className="font-mono">{order.orderNumber}</td>
                  <td>
                    <div className="font-medium">{order.customerName}</div>
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