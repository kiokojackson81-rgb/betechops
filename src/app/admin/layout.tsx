// src/app/admin/layout.tsx
import type { Metadata } from "next";
import "../globals.css";
import AdminTopbar from "./_components/AdminTopbar";
import AdminErrorBoundary from "./error-boundary";

export const metadata: Metadata = {
  title: "Jumia Ops – Admin",
};

// Prevent static prerender so DB queries only run at request time
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0b0e13] text-slate-100 antialiased min-h-screen">
      <AdminTopbar />
      <AdminErrorBoundary>
        <main className="min-h-screen">{children}</main>
      </AdminErrorBoundary>
    </div>
  );
}