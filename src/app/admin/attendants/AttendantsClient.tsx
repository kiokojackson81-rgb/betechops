"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import getLandingPage from "@/lib/getLandingPage";
type AttendantRow = {
  id: string;
  name: string | null;
  email: string;
  attendantCategory: string | null;
  categoryLabel?: string;
  isActive: boolean;
  createdAt?: string;
};

export default function AttendantsClient({ attendants }: { attendants: AttendantRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<AttendantRow[]>(attendants);
  const [filterCategory, setFilterCategory] = useState<any>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "DISABLED">("ALL");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const adminMap: Record<string, string> = {
    DIRECT_SALES_OPS: "/admin/marketing-report",
    MARKETING_OPS: "/admin/marketing-report",
    JUMIA_KILIMALL_OPS: "/admin/jumia-console",
    SUPPORT_OPS: "/admin/reports",
    BETECH_OPS: "/admin",
  };

  const filtered = rows.filter((a) => {
    if (filterCategory !== "ALL" && a.attendantCategory !== filterCategory) return false;
    if (filterStatus === "ACTIVE" && !a.isActive) return false;
    if (filterStatus === "DISABLED" && a.isActive) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Attendants</h1>
          <p className="text-sm text-slate-400">Manage attendant categories, status, passwords and dashboards.</p>
        </div>
        <div className="flex gap-3">
          <button
            className="text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800"
            onClick={() => router.push("/admin/payroll")}
          >
            Payroll overview
          </button>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm">
            <option value="ALL">All categories</option>
            <option value="DIRECT_SALES_OPS">Direct Sales Ops</option>
            <option value="MARKETING_OPS">Marketing Ops</option>
            <option value="JUMIA_KILIMALL_OPS">Jumia / Kilimall Ops</option>
            <option value="SUPPORT_OPS">Support Ops</option>
            <option value="BETECH_OPS">Betech Ops</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>
      </header>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/80 border-b border-white/10 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  {a.name ? (
                    <a
                      href={`${adminMap[a.attendantCategory ?? ""] ?? "/admin/marketing-report"}?impersonateId=${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-left text-slate-100 hover:underline"
                    >
                      {a.name}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`${adminMap[a.attendantCategory ?? ""] ?? "/admin/marketing-report"}?impersonateId=${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-left text-slate-300 hover:underline"
                  >
                    {a.email}
                  </a>
                </td>
                <td className="px-4 py-3">{a.categoryLabel ?? (a.attendantCategory ?? "Unassigned")}</td>
                <td className="px-4 py-3">
                  <span className={
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
                    (a.isActive ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40" : "bg-red-500/15 text-red-300 border border-red-500/40")
                  }>
                    {a.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800" onClick={() => router.push(`/admin/attendants/${a.id}`)}>
                      Edit
                    </button>
                    <button className="text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800" onClick={() => router.push(`/admin/attendants/${a.id}/payroll`)}>
                      Payroll
                    </button>
                    <a
                      href={`${getLandingPage(a.attendantCategory || null)}?impersonateId=${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800 inline-flex items-center justify-center"
                    >
                      Open dashboard
                    </a>
                    {a.isActive ? (
                      <button
                        className="text-xs rounded-full border border-amber-600 px-3 py-1 hover:bg-slate-800"
                        disabled={loadingId === a.id}
                        onClick={async () => {
                          if (!confirm(`Disable ${a.email}?`)) return;
                          setLoadingId(a.id);
                          try {
                            const res = await fetch(`/api/admin/attendants/${a.id}`, {
                              method: "PATCH",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ action: "deactivate" }),
                            });
                            if (!res.ok) throw new Error("Request failed");
                            setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, isActive: false } : r)));
                          } catch (err) {
                            alert("Failed to disable attendant");
                          } finally {
                            setLoadingId(null);
                          }
                        }}
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        className="text-xs rounded-full border border-emerald-600 px-3 py-1 hover:bg-slate-800"
                        disabled={loadingId === a.id}
                        onClick={async () => {
                          if (!confirm(`Activate ${a.email}?`)) return;
                          setLoadingId(a.id);
                          try {
                            const res = await fetch(`/api/admin/attendants/${a.id}`, {
                              method: "PATCH",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ action: "activate" }),
                            });
                            if (!res.ok) throw new Error("Request failed");
                            setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, isActive: true } : r)));
                          } catch (err) {
                            alert("Failed to activate attendant");
                          } finally {
                            setLoadingId(null);
                          }
                        }}
                      >
                        Activate
                      </button>
                    )}
                    {/* Delete removed per request */}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No attendants found with the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
