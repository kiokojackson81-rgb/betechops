// src/app/admin/layout.tsx
import type { Metadata } from "next";
import "../globals.css";
import AdminTopbar from "./_components/AdminTopbar";

export const metadata: Metadata = {
  title: "Jumia Ops – Admin",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0b0e13] text-slate-100 antialiased min-h-screen">
      <AdminTopbar />
      <main className="min-h-screen">{children}</main>
    </div>
  );
}