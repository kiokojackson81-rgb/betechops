// src/app/admin/layout.tsx
import React from "react";
import Link from "next/link";
import { Package, Store, Receipt, FileText, Truck, Layers, Settings } from "lucide-react";
import AdminStatusBanner from "./_components/AdminStatusBanner";
import AdminTopbarBadges from "./_components/AdminTopbarBadges";
import "./admin.css";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview", icon: Receipt },
  { href: "/admin/shops", label: "Shops & Staff", icon: Store },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/returns", label: "Returns", icon: Truck },
  { href: "/admin/returns/jumia", label: "Jumia Returns", icon: Truck },
  { href: "/admin/catalog", label: "Catalog", icon: Layers },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg,#0f131b)] text-slate-100">
      {/* Top system status */}
      <div className="sticky top-0 z-50">
        <AdminStatusBanner />
        <div className="border-b border-white/10 bg-[var(--panel,#121723)]">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
            <Link href="/admin" className="font-semibold tracking-tight text-lg">BetechOps — Unified Admin</Link>
            <AdminTopbarBadges />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6 px-4 py-6">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <nav className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 rounded-xl border border-white/10 bg-[var(--panel,#121723)] px-3 py-2 hover:border-white/20 hover:bg-white/5"
              >
                <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          {/* Quick stats (small) */}
          <div className="mt-6 space-y-2 text-sm opacity-80">
            <div>Tips</div>
            <ul className="list-disc ml-5">
              <li>Use Shops & Staff to add Jumia/Kilimall shops + assign staff.</li>
              <li>Orders → Pending/RTS/Delivered filters are one click away.</li>
              <li>Catalog → price/stock/status feeds & feed history.</li>
            </ul>
          </div>
        </aside>

        {/* Main content */}
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          {children}
        </main>
      </div>
    </div>
  );
}