"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Attendant = {
  id: string;
  name: string | null;
  email: string;
  attendantCategory: string | null;
  isActive: boolean;
};

export default function AttendantEditorClient({ attendant, getCategoryLabel }: { attendant: Attendant; getCategoryLabel: (c?: any) => string }) {
  const router = useRouter();
  const [state, setState] = useState({ category: attendant.attendantCategory ?? "", isActive: attendant.isActive, password: "" });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${attendant.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ attendantCategory: state.category || undefined, isActive: state.isActive }) });
      if (!res.ok) throw new Error("save_failed");
      if (state.password) {
        const r2 = await fetch(`/api/users/${attendant.id}/password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: state.password }) });
        if (!r2.ok) throw new Error("password_failed");
      }
      router.refresh();
      alert("Saved");
    } catch (err) {
      alert(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">Edit attendant</h2>
      <div className="mb-4">Name: <strong>{attendant.name || "-"}</strong></div>
      <div className="mb-4">Email: <strong>{attendant.email}</strong></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <select className="col-span-1 rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm" value={state.category ?? ""} onChange={(e) => setState((s) => ({ ...s, category: e.target.value }))}>
          <option value="">-- Select category --</option>
          <option value="DIRECT_SALES_OPS">Direct Sales Ops</option>
          <option value="MARKETING_OPS">Marketing Ops</option>
          <option value="JUMIA_KILIMALL_OPS">Jumia / Kilimall Ops</option>
          <option value="SUPPORT_OPS">Support Ops</option>
          <option value="BETECH_OPS">Betech Ops</option>
        </select>

        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={state.isActive} onChange={(e) => setState((s) => ({ ...s, isActive: e.target.checked }))} /> Active
        </label>

        <input type="password" placeholder="New password (optional)" value={state.password} onChange={(e) => setState((s) => ({ ...s, password: e.target.value }))} className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm" />
      </div>

      <div className="flex gap-3">
        <button onClick={save} disabled={saving} className="rounded-full bg-emerald-500 px-4 py-2 text-black font-semibold">{saving ? "Saving…" : "Save"}</button>
        <button onClick={() => router.push(`/admin/attendants/${attendant.id}?action=impersonate`)} className="rounded-full border border-slate-700 px-4 py-2">Open dashboard</button>
      </div>
    </div>
  );
}
