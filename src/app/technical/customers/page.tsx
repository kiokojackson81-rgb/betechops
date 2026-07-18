import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { auth } from "@/lib/auth";
import { getAdminCustomersData } from "@/lib/adminCustomers";
import getLandingPage from "@/lib/getLandingPage";
import { prisma } from "@/lib/prisma";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) return "—";
  return parsed.toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function resolveViewer() {
  const session = await auth().catch(() => null);
  const sessionUser = session?.user as
    | {
        id?: string | null;
        role?: string | null;
        attendantCategory?: string | null;
      }
    | undefined;

  if (!session || !sessionUser?.id) {
    redirect("/login");
  }

  const isAdmin = sessionUser.role === "ADMIN";
  const adminPreviewUser = isAdmin
    ? await prisma.user.findFirst({
        where: {
          attendantCategory: "TECHNICAL_TEAM",
          isActive: true,
        },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          attendantCategory: true,
          isActive: true,
        },
      })
    : null;

  const targetId = adminPreviewUser?.id || sessionUser.id;
  const viewer = adminPreviewUser
    ? adminPreviewUser
    : await prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          name: true,
          email: true,
          attendantCategory: true,
          isActive: true,
        },
      });

  if (!viewer || !viewer.isActive) {
    redirect("/login");
  }

  if (sessionUser.role !== "ADMIN" && !isTechnicalTeamCategory(viewer.attendantCategory)) {
    redirect(getLandingPage(viewer.attendantCategory ?? null, sessionUser.role ?? undefined));
  }

  return viewer;
}

export default async function TechnicalCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const viewer = await resolveViewer();
  const params = (await searchParams) || {};
  const q = String(params.q || "").trim();
  const customers = q ? (await getAdminCustomersData(q, "recent")).slice(0, 12) : [];

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/8 via-white/4 to-transparent p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-emerald-300/80">Customer lookup</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Search customer details</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Search by phone number, receipt number, purchase reference, customer email, or customer name. Only matching customer details will appear here.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#091223] px-4 py-3 text-sm text-slate-300">
            Signed in as <span className="font-medium text-white">{viewer.name || viewer.email || "Technical Team"}</span>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#091223] p-5">
        <form className="flex flex-col gap-3 lg:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Enter phone, receipt, purchase ref, email, or customer name"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
            />
          </label>
          <button
            type="submit"
            className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
          >
            Search customer
          </button>
        </form>
      </section>

      {!q ? (
        <section className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400">
          Enter a customer phone number, receipt number, purchase reference, email, or name to view matching customer details. No full customer list is shown on this page.
        </section>
      ) : customers.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400">
          No customer matched <span className="font-medium text-white">{q}</span>.
        </section>
      ) : (
        <section className="space-y-4">
          {customers.map((customer) => (
            <article key={customer.id} className="rounded-[28px] border border-white/10 bg-[#091223] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">{customer.displayName}</h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-300">
                    {customer.phones.map((phone) => (
                      <span key={phone} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                        {phone}
                      </span>
                    ))}
                    {customer.emails.map((email) => (
                      <span key={email} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300 sm:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Orders</div>
                    <div className="mt-1 text-lg font-semibold text-white">{customer.totalOrders}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Receipts</div>
                    <div className="mt-1 text-lg font-semibold text-white">{customer.totalReceipts}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Total spend</div>
                    <div className="mt-1 text-lg font-semibold text-white">{formatCurrency(customer.totalSpend)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Outstanding</div>
                    <div className="mt-1 text-lg font-semibold text-white">{formatCurrency(customer.outstandingBalance)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Customer since</div>
                  <div className="mt-2 text-sm text-white">{formatDate(customer.firstPurchaseAt)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last purchase</div>
                  <div className="mt-2 text-sm text-white">{formatDate(customer.lastPurchaseAt)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recent products</div>
                  <div className="mt-2 text-sm text-white">{customer.recentProductNames.join(", ") || "—"}</div>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-sm font-semibold text-white">Recent purchases</div>
                <div className="mt-3 space-y-3">
                  {customer.orders.slice(0, 6).map((order) => (
                    <div key={`${order.source}-${order.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="text-base font-semibold text-white">{order.orderNumber}</div>
                          <div className="mt-1 text-sm text-slate-300">
                            {[order.source, order.receiptNumber, order.paymentStatus].filter(Boolean).join(" · ")}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDate(order.createdAt)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-semibold text-white">{formatCurrency(order.totalAmount)}</div>
                          <div className="text-sm text-slate-400">Paid {formatCurrency(order.paidAmount)}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-slate-300">
                        {order.items.map((item) => `${item.productName} x${item.quantity}`).join(", ") || "No item details"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
