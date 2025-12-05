import type { ReactNode } from "react";
import AdminOnlineNav from "./_components/AdminOnlineNav";

export default function AdminOnlineLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-white/10 bg-slate-900/60">
        <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Admin</p>
            <h1 className="text-2xl font-semibold text-white">Online Operations</h1>
            <p className="text-sm text-slate-400">
              Monitor marketplace accounts, returns and aggregate sales synced via the new online ops pipelines.
            </p>
          </div>
          <AdminOnlineNav />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

