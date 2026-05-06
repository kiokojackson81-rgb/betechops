"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import getLandingPage from "@/lib/getLandingPage";

type Attendant = {
  id: string;
  name: string | null;
  email: string;
  attendantCategory: string | null;
  categoryLabel?: string;
  isActive: boolean;
};

export default function AttendantEditorClient({ attendant }: { attendant: Attendant }) {
  const router = useRouter();
  const [state, setState] = useState({ category: attendant.attendantCategory ?? "", isActive: attendant.isActive, password: "" });
  const [commission, setCommission] = useState<{
    posTotalsMode: "NONE" | "USER" | "GLOBAL";
    salesCommissionMode: "DEFAULT_TIERS" | "JENIFFER_PRORATED" | "BRENDAH_DIRECT";
  }>({
    posTotalsMode: "NONE",
    salesCommissionMode: "DEFAULT_TIERS",
  });
  const [saving, setSaving] = useState(false);
  const [loadingCommission, setLoadingCommission] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCommission(true);
      try {
        const res = await fetch(`/api/admin/attendants/${attendant.id}/commission-config`, { credentials: "same-origin" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const cfg = data?.config;
        if (!cancelled && cfg) {
          setCommission({
            posTotalsMode: (cfg.posTotalsMode as any) ?? "NONE",
            salesCommissionMode: (cfg.salesCommissionMode as any) ?? "DEFAULT_TIERS",
          });
        }
      } finally {
        if (!cancelled) setLoadingCommission(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attendant.id]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${attendant.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ attendantCategory: state.category || undefined, isActive: state.isActive }) });
      if (!res.ok) throw new Error("save_failed");

      const resCommission = await fetch(`/api/admin/attendants/${attendant.id}/commission-config`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          posTotalsMode: commission.posTotalsMode,
          salesCommissionMode: commission.salesCommissionMode,
        }),
      });
      if (!resCommission.ok) throw new Error("commission_save_failed");

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
      <div className="mb-4">Category: <strong>{attendant.categoryLabel ?? (attendant.attendantCategory ?? "Unassigned")}</strong></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <select className="col-span-1 rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm" value={state.category ?? ""} onChange={(e) => setState((s) => ({ ...s, category: e.target.value }))}>
          <option value="">-- Select category --</option>
          <option value="DIRECT_SALES_OPS">Direct Sales Ops</option>
          <option value="MARKETING_OPS">Marketing Ops</option>
          <option value="JUMIA_KILIMALL_OPS">Jumia / Kilimall Ops</option>
          <option value="SUPPORT_OPS">Support Ops</option>
          <option value="GENERAL_OPS">General User Ops</option>
          <option value="BETECH_OPS">Betech Ops (Legacy)</option>
        </select>

        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={state.isActive} onChange={(e) => setState((s) => ({ ...s, isActive: e.target.checked }))} /> Active
        </label>

        <input type="password" placeholder="New password (optional)" value={state.password} onChange={(e) => setState((s) => ({ ...s, password: e.target.value }))} className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm" />
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 mb-4">
        <h3 className="text-sm font-semibold mb-2">Commission Structure (Per Account)</h3>
        <p className="text-xs text-slate-400 mb-3">
          These settings override category-based defaults. They are stored on the attendant account.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs uppercase tracking-wide text-slate-400">POS totals source</div>
            <select
              disabled={loadingCommission}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
              value={commission.posTotalsMode}
              onChange={(e) => setCommission((s) => ({ ...s, posTotalsMode: e.target.value as any }))}
            >
              <option value="NONE">Use marketing/support entries</option>
              <option value="USER">Use POS receipts (this user)</option>
              <option value="GLOBAL">Use POS receipts (global)</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs uppercase tracking-wide text-slate-400">Sales commission mode</div>
            <select
              disabled={loadingCommission}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
              value={commission.salesCommissionMode}
              onChange={(e) => setCommission((s) => ({ ...s, salesCommissionMode: e.target.value as any }))}
            >
              <option value="DEFAULT_TIERS">Default (tiered ladder)</option>
              <option value="JENIFFER_PRORATED">Prorated next tier (Jeniffer)</option>
              <option value="BRENDAH_DIRECT">Direct progressive (Brendah)</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={save} disabled={saving} className="rounded-full bg-emerald-500 px-4 py-2 text-black font-semibold">{saving ? "Saving…" : "Save"}</button>
        <button
          onClick={() => {
              const dest = getLandingPage(attendant.attendantCategory || null);
              router.push(`${dest}?impersonateId=${attendant.id}`);
            }}
          className="rounded-full border border-slate-700 px-4 py-2"
        >
          Open dashboard
        </button>
      </div>
    </div>
  );
}
