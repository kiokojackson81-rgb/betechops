"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import getLandingPage from "@/lib/getLandingPage";
import { TECHNICAL_PERMISSION_SCOPES, TECHNICAL_TEAM_ROLE_OPTIONS } from "@/lib/technicalTeam";

type Attendant = {
  id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
  attendantCategory: string | null;
  categoryLabel?: string;
  isActive: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  technicalProfile?: {
    teamRole?: string | null;
    positionTitle?: string | null;
    employeeNumber?: string | null;
    phoneNumber?: string | null;
    epraLicenseNumber?: string | null;
    epraLicenseClass?: string | null;
    drivingLicenseDetails?: string | null;
    employmentDate?: string | Date | null;
    activeAccount?: boolean | null;
    permissionScope?: string | null;
  } | null;
};

export default function AttendantEditorClient({ attendant }: { attendant: Attendant }) {
  const router = useRouter();
  const [state, setState] = useState({
    category: attendant.attendantCategory ?? "",
    isActive: attendant.isActive,
    password: "",
    phone: attendant.phone ?? "",
    bankName: attendant.bankName ?? "",
    bankAccountNumber: attendant.bankAccountNumber ?? "",
    technical: {
      teamRole: attendant.technicalProfile?.teamRole ?? "",
      positionTitle: attendant.technicalProfile?.positionTitle ?? "",
      employeeNumber: attendant.technicalProfile?.employeeNumber ?? "",
      phoneNumber: attendant.technicalProfile?.phoneNumber ?? attendant.phone ?? "",
      epraLicenseNumber: attendant.technicalProfile?.epraLicenseNumber ?? "",
      epraLicenseClass: attendant.technicalProfile?.epraLicenseClass ?? "",
      drivingLicenseDetails: attendant.technicalProfile?.drivingLicenseDetails ?? "",
      employmentDate:
        attendant.technicalProfile?.employmentDate
          ? new Date(attendant.technicalProfile.employmentDate).toISOString().slice(0, 10)
          : "",
      activeAccount: attendant.technicalProfile?.activeAccount ?? attendant.isActive,
      permissionScope: attendant.technicalProfile?.permissionScope ?? TECHNICAL_PERMISSION_SCOPES[2],
    },
  });
  const [commission, setCommission] = useState<{
    posTotalsMode: "NONE" | "USER" | "GLOBAL";
    salesCommissionMode: "DEFAULT_TIERS" | "JENIFFER_PRORATED" | "BRENDAH_DIRECT" | "POS_PROFIT_10";
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
      const res = await fetch(`/api/users/${attendant.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attendantCategory: state.category || undefined,
          isActive: state.isActive,
          phone: state.phone.trim() || null,
          bankName: state.bankName.trim() || null,
          bankAccountNumber: state.bankAccountNumber.trim() || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "save_failed");
      }

      const resCommission = await fetch(`/api/admin/attendants/${attendant.id}/commission-config`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          posTotalsMode: commission.posTotalsMode,
          salesCommissionMode: commission.salesCommissionMode,
        }),
      });
      if (!resCommission.ok) {
        const payload = await resCommission.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "commission_save_failed");
      }

      if (state.category === "TECHNICAL_TEAM") {
        const technicalRes = await fetch(`/api/admin/technical-team/${attendant.id}/profile`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            teamRole: state.technical.teamRole || null,
            positionTitle: state.technical.positionTitle || null,
            employeeNumber: state.technical.employeeNumber || null,
            phoneNumber: state.technical.phoneNumber || state.phone.trim() || null,
            epraLicenseNumber: state.technical.epraLicenseNumber || null,
            epraLicenseClass: state.technical.epraLicenseClass || null,
            drivingLicenseDetails: state.technical.drivingLicenseDetails || null,
            employmentDate: state.technical.employmentDate || null,
            activeAccount: state.technical.activeAccount,
            permissionScope: state.technical.permissionScope || null,
          }),
        });
        if (!technicalRes.ok) {
          const payload = await technicalRes.json().catch(() => null);
          throw new Error(payload?.detail || payload?.error || "technical_profile_save_failed");
        }
      }

      if (state.password) {
        const r2 = await fetch(`/api/users/${attendant.id}/password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: state.password }) });
        if (!r2.ok) {
          const payload = await r2.json().catch(() => null);
          throw new Error(payload?.detail || payload?.error || "password_failed");
        }
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
      <div className="mb-4">Email: <strong>{attendant.email || "-"}</strong></div>
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
          <option value="TECHNICAL_TEAM">Technical Team</option>
        </select>

        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={state.isActive} onChange={(e) => setState((s) => ({ ...s, isActive: e.target.checked }))} /> Active
        </label>

        <input type="password" placeholder="New password (optional)" value={state.password} onChange={(e) => setState((s) => ({ ...s, password: e.target.value }))} className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <input
          type="text"
          placeholder="Phone number"
          value={state.phone}
          onChange={(e) => setState((s) => ({ ...s, phone: e.target.value }))}
          className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 mb-4">
        <h3 className="text-sm font-semibold mb-2">Banking details</h3>
        <p className="text-xs text-slate-400 mb-3">
          Admin-only banking details for payroll and future payout exports.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Bank name"
            value={state.bankName}
            onChange={(e) => setState((s) => ({ ...s, bankName: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Account number"
            value={state.bankAccountNumber}
            onChange={(e) => setState((s) => ({ ...s, bankAccountNumber: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {state.category === "TECHNICAL_TEAM" ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-4">
          <h3 className="text-sm font-semibold mb-2">Technical team profile</h3>
          <p className="text-xs text-slate-400 mb-3">
            Role, licence, and field credentials for the technical dashboard.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
              value={state.technical.teamRole}
              onChange={(e) => setState((s) => ({
                ...s,
                technical: {
                  ...s.technical,
                  teamRole: e.target.value,
                  positionTitle: s.technical.positionTitle || e.target.value,
                },
              }))}
            >
              <option value="">Select team role</option>
              {TECHNICAL_TEAM_ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Position / job title"
              value={state.technical.positionTitle}
              onChange={(e) => setState((s) => ({ ...s, technical: { ...s.technical, positionTitle: e.target.value } }))}
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Employee number"
              value={state.technical.employeeNumber}
              onChange={(e) => setState((s) => ({ ...s, technical: { ...s.technical, employeeNumber: e.target.value } }))}
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Technical phone"
              value={state.technical.phoneNumber}
              onChange={(e) => setState((s) => ({ ...s, technical: { ...s.technical, phoneNumber: e.target.value } }))}
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="EPRA licence number"
              value={state.technical.epraLicenseNumber}
              onChange={(e) => setState((s) => ({ ...s, technical: { ...s.technical, epraLicenseNumber: e.target.value } }))}
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Licence class"
              value={state.technical.epraLicenseClass}
              onChange={(e) => setState((s) => ({ ...s, technical: { ...s.technical, epraLicenseClass: e.target.value } }))}
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Driving licence details"
              value={state.technical.drivingLicenseDetails}
              onChange={(e) => setState((s) => ({ ...s, technical: { ...s.technical, drivingLicenseDetails: e.target.value } }))}
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={state.technical.employmentDate}
              onChange={(e) => setState((s) => ({ ...s, technical: { ...s.technical, employmentDate: e.target.value } }))}
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            />
            <select
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
              value={state.technical.permissionScope}
              onChange={(e) => setState((s) => ({ ...s, technical: { ...s.technical, permissionScope: e.target.value } }))}
            >
              {TECHNICAL_PERMISSION_SCOPES.map((option) => (
                <option key={option} value={option}>{option.replace(/_/g, " ")}</option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={state.technical.activeAccount}
                onChange={(e) => setState((s) => ({ ...s, technical: { ...s.technical, activeAccount: e.target.checked } }))}
              />
              Technical account active
            </label>
          </div>
        </div>
      ) : null}

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
              <option value="POS_PROFIT_10">10% of POS profit</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={save} disabled={saving} className="rounded-full bg-emerald-500 px-4 py-2 text-black font-semibold">{saving ? "Saving…" : "Save"}</button>
        <button
          onClick={() => {
              const dest = getLandingPage(state.category || attendant.attendantCategory || null);
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
