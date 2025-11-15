"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantsManager;
const react_1 = require("react");
const categories_1 = require("@/lib/attendants/categories");
const toast_1 = require("@/lib/ui/toast");
const categoryFilters = [{ id: "ALL", label: "All categories" }, ...categories_1.attendantCategoryOptions];
function formatDate(input) {
    const d = new Date(input);
    if (!Number.isFinite(d.valueOf()))
        return "—";
    return d.toLocaleDateString();
}
function AttendantsManager({ initial }) {
    const [rows, setRows] = (0, react_1.useState)(initial);
    const [filter, setFilter] = (0, react_1.useState)("ALL");
    const [busy, setBusy] = (0, react_1.useState)(null);
    const summary = (0, react_1.useMemo)(() => {
        return rows.reduce((acc, row) => {
            for (const cat of row.categories) {
                acc[cat] = (acc[cat] || 0) + 1;
            }
            return acc;
        }, {});
    }, [rows]);
    const filtered = (0, react_1.useMemo)(() => {
        if (filter === "ALL")
            return rows;
        return rows.filter((row) => row.categories.includes(filter));
    }, [filter, rows]);
    async function updateCategories(id, categories) {
        if (!categories.length) {
            (0, toast_1.showToast)("Select at least one category", "error");
            return;
        }
        setBusy(id);
        const previous = rows.map((row) => ({ ...row }));
        const primary = categories[0];
        setRows((prev) => prev.map((row) => row.id === id ? { ...row, categories: categories.slice(), attendantCategory: primary } : row));
        const res = await fetch(`/api/users/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categories, attendantCategory: primary }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            (0, toast_1.showToast)(json?.error || "Failed to update categories", "error");
            setRows(previous);
        }
        else {
            (0, toast_1.showToast)("Attendant categories updated", "success");
        }
        setBusy(null);
    }
    return (<div className="space-y-6">
      <section>
        <div className="flex flex-wrap gap-3">
          {categoryFilters.map((cat) => {
            const count = cat.id === "ALL" ? rows.length : summary[cat.id] || 0;
            return (<button key={cat.id} onClick={() => setFilter(cat.id)} className={`rounded-full border px-3 py-1 text-sm transition ${filter === cat.id ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-slate-300 hover:border-white/20"}`}>
                {cat.label} <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">{count}</span>
              </button>);
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
              <th className="px-4 py-3 font-medium">Categories</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-[#0f141f] text-slate-200">
            {filtered.map((row) => {
            const activeDefs = row.categories
                .map((cat) => categories_1.attendantCategories.find((c) => c.id === cat))
                .filter(Boolean);
            return (<tr key={row.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{row.name || "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{row.email}</td>
                  <td className="px-4 py-3">{row.role}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        {categories_1.attendantCategoryOptions.map((opt) => {
                    const checked = row.categories.includes(opt.id);
                    return (<label key={opt.id} className="flex items-center gap-2 text-xs text-slate-300">
                              <input type="checkbox" className="rounded border border-white/20 bg-transparent" checked={checked} disabled={busy === row.id} onChange={(e) => {
                            const next = e.target.checked
                                ? Array.from(new Set([...row.categories, opt.id]))
                                : row.categories.filter((c) => c !== opt.id);
                            if (!next.length) {
                                (0, toast_1.showToast)("Attendant must have at least one category", "error");
                                return;
                            }
                            updateCategories(row.id, next);
                        }}/>
                              <span>{opt.label}</span>
                            </label>);
                })}
                      </div>
                      <div className="text-xs text-slate-400">
                        {activeDefs.map((def, idx) => (<span key={def.id} className="mr-2">
                            <span className="font-medium text-white">{def.label}</span>
                            {idx === 0 ? <span className="ml-1 text-emerald-300">(primary)</span> : null}
                          </span>))}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${row.isActive ? "bg-emerald-600/20 text-emerald-300" : "bg-red-600/20 text-red-300"}`}>
                      {row.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{formatDate(row.createdAt)}</td>
                </tr>);
        })}
            {filtered.length === 0 && (<tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No attendants in this category yet.
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>);
}
