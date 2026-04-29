// src/app/admin/layout.tsx
import React from "react";
import Link from "next/link";
import AdminStatusBanner from "./_components/AdminStatusBanner";
import AdminNavContainer from "./_components/AdminNavContainer";
import AdminHeaderShell from "./_components/AdminHeaderShell";
import AdminTips from "./_components/AdminTips";
import "./admin.css";

export const dynamic = "force-dynamic";

// NAV items live in _components/adminNav.ts now.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg,#0f131b)] text-slate-100">
      {/* Sticky top system status + nav bar */}
      <AdminHeaderShell>
        <AdminStatusBanner />
        <div className="border-b border-white/10 bg-[var(--panel,#121723)] backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--panel)#121723,transparent_15%)]">
          <AdminNavContainer />
        </div>
      </AdminHeaderShell>

      {/* Page body */}
      <div className="page-shell py-6 space-y-6">
        <main role="main" className="space-y-8">{children}</main>
        <AdminTips />
      </div>
    </div>
  );
}
