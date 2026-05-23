import PosManagementClient from "./PosManagementClient";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

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
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">POS Management</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Products, buying price, and commission approvals</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Manage the catalog used on the receipts desk, define buying prices and per-product commission, and release or reject pending POS commission approvals.
        </p>
      </section>
      <PosManagementClient limitedAccess={!hasFullAccess && isBrendah} />
    </main>
  );
}
