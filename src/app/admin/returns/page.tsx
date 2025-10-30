import { prisma } from "@/lib/prisma";
import { resolveShopScopeForServer } from "@/lib/scope";
import { syncReturnOrders } from "@/lib/jobs/jumia";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import AutoRefresh from "@/app/_components/AutoRefresh";

export const dynamic = "force-dynamic";
const PAGE_SIZE_DEFAULT = 10;
const RETURN_STATUSES = ["pickup_scheduled", "picked_up"] as const;

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

function buildWhere(term: string | undefined): Prisma.ReturnCaseWhereInput {
  const where: Prisma.ReturnCaseWhereInput = { status: { in: [...RETURN_STATUSES] } };
  if (!term) return where;
  return {
    ...where,
    OR: [
      { order: { is: { orderNumber: { contains: term } } } },
      { order: { is: { customerName: { contains: term } } } },
      { shop: { is: { name: { contains: term } } } },
    ],
  };
}

type ReturnRow = Awaited<ReturnType<typeof fetchReturns>>[0];

async function fetchReturns(where: Prisma.ReturnCaseWhereInput, page: number, size: number) {
  return await prisma.returnCase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * size,
    take: size,
    include: {
      shop: { select: { name: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          createdAt: true,
          paidAmount: true,
          items: {
            select: {
              quantity: true,
              sellingPrice: true,
              product: { select: { name: true, sku: true } },
            },
          },
        },
      },
    },
  });
}

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; q?: string; size?: string }>;
}) {
  const params = await searchParams;
  const scope = await resolveShopScopeForServer();
  const page = Math.max(1, Number(params?.page || 1));
  const size = Math.min(50, Math.max(1, Number(params?.size || PAGE_SIZE_DEFAULT)));
  const q = (params?.q || "").trim() || undefined;

  let syncError: string | null = null;
  try {
    await syncReturnOrders({ lookbackDays: 30 });
  } catch (e) {
    syncError = e instanceof Error ? e.message : String(e);
  }

  const whereBase = buildWhere(q);
  const where: Prisma.ReturnCaseWhereInput =
    scope.shopIds && scope.shopIds.length > 0
      ? { ...whereBase, shopId: { in: scope.shopIds } }
      : whereBase;

  let degraded = false;
  let total = 0;
  let rows: ReturnRow[] = [];

  try {
    [total, rows] = await Promise.all([
      prisma.returnCase.count({ where }),
      fetchReturns(where, page, size),
    ]);
  } catch (e) {
    console.error("ReturnsPage DB error:", e);
    degraded = true;
  }

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Returns - Waiting Pickup</h1>
          <p className="text-slate-400 text-sm">
            Vendor returns synced from Jumia. Mark them as picked once the parcel is collected.
          </p>
          {syncError && (
            <p className="mt-1 text-xs text-yellow-300/80">
              Sync degraded: {syncError}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <AutoRefresh storageKey="autoRefreshReturns" intervalMs={60000} defaultEnabled={true} />
          <form className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={q || ""}
              placeholder="Search order #, customer, shop."
              className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:bg-white/10"
            />
            <select
              name="size"
              defaultValue={String(size)}
              className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-sm"
            >
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n}/page
                </option>
              ))}
            </select>
            <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10">
              Apply
            </button>
          </form>
        </div>
      </header>

      {degraded && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Database is unavailable or misconfigured.</p>
            <p className="text-sm opacity-90">
              Showing 0 results. Check DATABASE_URL and migrations. See Admin → Health Checks.
            </p>
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
              <th>Items</th>
              <th>Value</th>
              <th>Status</th>
              <th>Created</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((ret) => {
              const order = ret.order;
              const items = order?.items || [];
              const itemsCount = items.reduce((sum, it) => sum + it.quantity, 0);
              const value = items.reduce((sum, it) => sum + (Number(it.sellingPrice || 0) * it.quantity), 0);
              const picked = ret.status === "picked_up" || Boolean(ret.pickedAt);
              return (
                <tr key={ret.id} className="[&>td]:px-3 [&>td]:py-3">
                  <td className="font-mono">{order?.orderNumber || "—"}</td>
                  <td>
                    <div className="font-medium">{order?.customerName || "—"}</div>
                  </td>
                  <td>{ret.shop?.name || "—"}</td>
                  <td>{itemsCount}</td>
                  <td>{fmtKsh(value)}</td>
                  <td>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${picked ? "bg-emerald-500/10 text-emerald-200" : "bg-orange-500/10 text-orange-200"}`}>
                      {picked ? "Picked" : "Waiting pickup"}
                    </span>
                  </td>
                  <td>{order?.createdAt ? fmtDate(order.createdAt) : fmtDate(ret.createdAt)}</td>
                  <td className="text-right">
                    <Link
                      href={`/admin/returns/${ret.id}`}
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
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  No returns found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
        <div>
          Page <span className="font-semibold">{page}</span> of{" "}
          <span className="font-semibold">{totalPages}</span> • {total} total
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/returns?${new URLSearchParams({
              q: q || "",
              size: String(size),
              page: String(Math.max(1, page - 1)),
            }).toString()}`}
            className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10"
          >
            Prev
          </Link>
          <Link
            href={`/admin/returns?${new URLSearchParams({
              q: q || "",
              size: String(size),
              page: String(Math.min(totalPages, page + 1)),
            }).toString()}`}
            className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10"
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
