"use client";

import { useMemo, useState } from "react";
import { attendantCategories, attendantCategoryOptions } from "@/lib/attendants/categories";
import { showToast } from "@/lib/ui/toast";

type AttendantLite = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  attendantCategory: string;
  isActive: boolean;
  createdAt: string;
};

const categoryFilters = [{ id: "ALL", label: "All categories" }, ...attendantCategoryOptions];

function formatDate(input: string) {
  const d = new Date(input);
  if (!Number.isFinite(d.valueOf())) return "—";
  return d.toLocaleDateString();
}

export default function AttendantsManager({ initial }: { initial: AttendantLite[] }) {
  const [rows, setRows] = useState<AttendantLite[]>(initial);
  const [filter, setFilter] = useState<string>("ALL");
  const [busy, setBusy] = useState<string | null>(null);

  const summary = useMemo(() => {
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.attendantCategory] = (acc[row.attendantCategory] || 0) + 1;
      return acc;
    }, {});
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return rows;
    return rows.filter((row) => row.attendantCategory === filter);
  }, [filter, rows]);

  async function updateCategory(id: string, attendantCategory: string) {
    setBusy(id);
    const previous = rows.map((row) => ({ ...row }));
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, attendantCategory } : row)));

    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendantCategory }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(json?.error || "Failed to update category", "error");
      setRows(previous);
    } else {
      showToast("Attendant category updated", "success");
    }
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap gap-3">
          {categoryFilters.map((cat) => {
            const def = attendantCategories.find((c) => c.id === cat.id);
            const count = cat.id === "ALL" ? rows.length : summary[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  filter === cat.id ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-slate-300 hover:border-white/20"
                }`}
              >
                {cat.label} <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5 text-left uppercase text-[11px] tracking-widest text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-[#0f141f] text-slate-200">
            {filtered.map((row) => {
              const def = attendantCategories.find((c) => c.id === row.attendantCategory);
              return (
                <tr key={row.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{row.name || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{row.email}</td>
                  <td className="px-4 py-3">{row.role}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <select
                        className="rounded border border-white/10 bg-transparent px-2 py-1 text-sm"
                        value={row.attendantCategory}
                        onChange={(e) => updateCategory(row.id, e.target.value)}
                        disabled={busy === row.id}
                      >
                        {attendantCategoryOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {def ? <p className="text-xs text-slate-400">{def.description}</p> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${row.isActive ? "bg-emerald-600/20 text-emerald-300" : "bg-red-600/20 text-red-300"}`}>
                      {row.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{formatDate(row.createdAt)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No attendants in this category yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
