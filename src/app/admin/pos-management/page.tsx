import PosManagementClient from "./PosManagementClient";

export const dynamic = "force-dynamic";

export default function PosManagementPage() {
  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">POS Management</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Products, buying price, and commission approvals</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Manage the catalog used on the receipts desk, define buying prices and per-product commission, and release or reject pending POS commission approvals.
        </p>
      </section>
      <PosManagementClient />
    </main>
  );
}
