// src/app/admin/layout.tsx
import React from "react";
import AdminNavContainer from "./_components/AdminNavContainer";
import AdminHeaderShell from "./_components/AdminHeaderShell";
import AdminTips from "./_components/AdminTips";
import VoiceSoftphoneShell from "@/components/voice/VoiceSoftphoneShell";
import "./admin.css";

export const dynamic = "force-dynamic";

// NAV items live in _components/adminNav.ts now.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <VoiceSoftphoneShell>
      <div className="min-h-screen bg-[var(--bg,#0f131b)] text-slate-100 print:min-h-0 print:bg-white">
        {/* Admin nav in normal document flow */}
        <AdminHeaderShell>
          <div className="border-b border-white/10 bg-[var(--panel,#121723)]">
            <AdminNavContainer />
          </div>
        </AdminHeaderShell>

        {/* Page body */}
        <div className="page-shell relative z-0 space-y-6 py-6 print:m-0 print:w-full print:max-w-none print:space-y-0 print:p-0">
          <main role="main" className="space-y-8 print:space-y-0">{children}</main>
          <div className="no-print">
            <AdminTips />
          </div>
        </div>
      </div>
    </VoiceSoftphoneShell>
  );
}
