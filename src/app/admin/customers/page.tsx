import Link from "next/link";
import { redirect } from "next/navigation";
import CustomersAdminClient from "@/app/admin/customers/CustomersAdminClient";
import { auth } from "@/lib/auth";
import { getAdminCustomersData } from "@/lib/adminCustomers";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "SUPERVISOR") redirect("/not-authorized");

  const params = (await searchParams) || {};
  const q = params.q?.trim() || "";
  const sort = params.sort?.trim() || "recent";
  const page = Math.max(1, Number(params.page || "1"));

  const customers = await getAdminCustomersData(q, sort);
  const prepared = customers.map((customer) => ({
    ...customer,
    firstPurchaseAt: customer.firstPurchaseAt ? customer.firstPurchaseAt.toISOString() : null,
    lastPurchaseAt: customer.lastPurchaseAt ? customer.lastPurchaseAt.toISOString() : null,
    orders: customer.orders.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
      receiptGeneratedAt: order.receiptGeneratedAt ? order.receiptGeneratedAt.toISOString() : null,
    })),
  }));

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(prepared.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedCustomers = prepared.slice((safePage - 1) * pageSize, safePage * pageSize);
  const displayStart = prepared.length ? (safePage - 1) * pageSize + 1 : 0;
  const displayEnd = prepared.length ? Math.min(safePage * pageSize, prepared.length) : 0;

  function buildHref(next: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    const merged = {
      q,
      sort,
      page: safePage,
      ...next,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value === undefined || value === "") continue;
      query.set(key, String(value));
    }
    return `/admin/customers${query.toString() ? `?${query.toString()}` : ""}`;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">POS Management</div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Customer desk</h1>
            <p className="max-w-3xl text-sm text-slate-400">
              Keep one harmonized customer list across POS receipts, website orders, and agent orders, then expand any row to review purchase history, contact details, and linked order activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/receipts"
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20"
            >
              Open receipts desk
            </Link>
            <Link
              href="/admin/orders"
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/35"
            >
              Open orders
            </Link>
          </div>
        </div>

        <form className="mt-6 grid gap-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-5 md:grid-cols-[1.2fr_220px_160px]">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search customer, phone, email, order number, shop, or product"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          />
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          >
            <option value="recent">Most recent activity</option>
            <option value="highest_spend">Highest spend</option>
            <option value="most_orders">Most orders</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <button type="submit" className="rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-95">
            Apply filters
          </button>
        </form>
      </section>

      <CustomersAdminClient customers={pagedCustomers} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.9),rgba(2,6,23,.95))] px-5 py-4 text-sm text-slate-300">
        <div>
          Showing {displayStart}-{displayEnd} of {prepared.length} customers
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={buildHref({ page: Math.max(1, safePage - 1) })}
            className={`rounded-xl border px-4 py-2 font-semibold ${safePage <= 1 ? "pointer-events-none border-white/5 text-slate-600" : "border-white/10 text-slate-100 hover:border-white/20"}`}
          >
            Previous
          </Link>
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Page {safePage} / {totalPages}</span>
          <Link
            href={buildHref({ page: Math.min(totalPages, safePage + 1) })}
            className={`rounded-xl border px-4 py-2 font-semibold ${safePage >= totalPages ? "pointer-events-none border-white/5 text-slate-600" : "border-white/10 text-slate-100 hover:border-white/20"}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
