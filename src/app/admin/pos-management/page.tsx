import PosManagementClient from "./PosManagementClient";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PosManagementPage() {
  const session = await auth();
  const role = String((session?.user as { role?: string } | undefined)?.role ?? "").toUpperCase();
  const email = String((session?.user as { email?: string } | undefined)?.email ?? "").trim().toLowerCase();
  const isBrendah = email === "brendah@betech.co.ke";
  const hasFullAccess = role === "ADMIN" || role === "SUPERVISOR";

  if (!hasFullAccess && !isBrendah) {
    return redirect("/not-authorized");
  }

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">POS Management</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Products, buying price, and commission approvals</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Manage the catalog used on the receipts desk, define buying prices and per-product commission, and release or reject pending POS commission approvals.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href="/admin/customers"
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
            >
              Open Customers
            </Link>
            <Link
              href="/admin/settings/shop-images"
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/15"
            >
              Open Shop Images
            </Link>
          </div>
        </div>
      </section>
      <PosManagementClient mode={isBrendah ? "product-desk" : "admin"} />
    </main>
  );
}
