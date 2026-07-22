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
  payoutMethod?: string | null;
  payoutAccountName?: string | null;
  mobileMoneyPhoneNumber?: string | null;
  tillPaybillNumber?: string | null;
  tillPaybillBusinessName?: string | null;
  paybillAccountNumber?: string | null;
  notificationPhoneNumber?: string | null;
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
  employeeDocuments?: Array<{
    id: string;
    documentType: string;
    title: string;
    fileUrl: string;
    notes?: string | null;
    createdAt: string | Date;
    uploadedBy?: {
      id: string;
      name?: string | null;
      email?: string | null;
    } | null;
  }>;
};

type EmployeeDocumentRow = NonNullable<Attendant["employeeDocuments"]>[number];

const EMPLOYMENT_DOCUMENT_TYPES = [
  "NATIONAL_ID",
  "CONTRACT",
  "EPRA_LICENSE",
  "DRIVING_LICENSE",
  "CERTIFICATE",
  "KRA_PIN",
  "NSSF_NHIF",
  "OTHER",
] as const;

const PAYOUT_METHODS = [
  { value: "", label: "Select payout method" },
  { value: "BANK", label: "Bank" },
  { value: "MPESA", label: "M-Pesa" },
  { value: "TILL", label: "Till" },
  { value: "PAYBILL", label: "Paybill" },
] as const;

function formatDocumentType(value: string) {
  return String(value || "OTHER")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AttendantEditorClient({ attendant }: { attendant: Attendant }) {
  const router = useRouter();
  const [state, setState] = useState({
    category: attendant.attendantCategory ?? "",
    isActive: attendant.isActive,
    password: "",
    phone: attendant.phone ?? "",
    bankName: attendant.bankName ?? "",
    bankAccountNumber: attendant.bankAccountNumber ?? "",
    payoutMethod: attendant.payoutMethod ?? "",
    payoutAccountName: attendant.payoutAccountName ?? attendant.name ?? "",
    mobileMoneyPhoneNumber: attendant.mobileMoneyPhoneNumber ?? attendant.phone ?? "",
    tillPaybillNumber: attendant.tillPaybillNumber ?? "",
    tillPaybillBusinessName: attendant.tillPaybillBusinessName ?? "",
    paybillAccountNumber: attendant.paybillAccountNumber ?? "",
    notificationPhoneNumber: attendant.notificationPhoneNumber ?? attendant.phone ?? "",
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
  const [employeeDocuments, setEmployeeDocuments] = useState<EmployeeDocumentRow[]>(attendant.employeeDocuments ?? []);
  const [documentForm, setDocumentForm] = useState({
    documentType: "NATIONAL_ID",
    title: "",
    notes: "",
    file: null as File | null,
  });
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

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

  async function uploadEmployeeDocument() {
    if (!documentForm.file) {
      alert("Select a file first.");
      return;
    }
    if (!documentForm.title.trim()) {
      alert("Enter a document title.");
      return;
    }

    setUploadingDocument(true);
    try {
      const formData = new FormData();
      formData.set("file", documentForm.file);
      formData.set("documentType", documentForm.documentType);
      formData.set("title", documentForm.title.trim());
      formData.set("notes", documentForm.notes.trim());

      const res = await fetch(`/api/admin/attendants/${attendant.id}/documents`, {
        method: "POST",
        body: formData,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || "document_upload_failed");
      }

      setEmployeeDocuments((current) => [payload.document as EmployeeDocumentRow, ...current]);
      setDocumentForm({
        documentType: "NATIONAL_ID",
        title: "",
        notes: "",
        file: null,
      });
      router.refresh();
      alert("Employment document uploaded.");
    } catch (error) {
      alert(String(error));
    } finally {
      setUploadingDocument(false);
    }
  }

  async function deleteEmployeeDocument(documentId: string) {
    if (!confirm("Delete this employment document?")) return;

    setDeletingDocumentId(documentId);
    try {
      const res = await fetch(`/api/admin/attendants/${attendant.id}/documents?documentId=${encodeURIComponent(documentId)}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || "document_delete_failed");
      }
      setEmployeeDocuments((current) => current.filter((document) => document.id !== documentId));
      router.refresh();
    } catch (error) {
      alert(String(error));
    } finally {
      setDeletingDocumentId(null);
    }
  }

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
          payoutMethod: state.payoutMethod || null,
          payoutAccountName: state.payoutAccountName.trim() || null,
          mobileMoneyPhoneNumber: state.mobileMoneyPhoneNumber.trim() || null,
          tillPaybillNumber: state.tillPaybillNumber.trim() || null,
          tillPaybillBusinessName: state.tillPaybillBusinessName.trim() || null,
          paybillAccountNumber: state.paybillAccountNumber.trim() || null,
          notificationPhoneNumber: state.notificationPhoneNumber.trim() || null,
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
        <h3 className="text-sm font-semibold mb-2">Payout details</h3>
        <p className="text-xs text-slate-400 mb-3">
          Admin-only payout profile for payroll review, PDF export, and Openfloat upload files.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={state.payoutMethod}
            onChange={(e) => setState((s) => ({ ...s, payoutMethod: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
          >
            {PAYOUT_METHODS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Notification phone number"
            value={state.notificationPhoneNumber}
            onChange={(e) => setState((s) => ({ ...s, notificationPhoneNumber: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Account name"
            value={state.payoutAccountName}
            onChange={(e) => setState((s) => ({ ...s, payoutAccountName: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm sm:col-span-2"
          />
          {(state.payoutMethod === "BANK" || state.payoutMethod === "PAYBILL") ? (
            <input
              type="text"
              placeholder={state.payoutMethod === "BANK" ? "Bank name" : "Paybill account number"}
              value={state.payoutMethod === "BANK" ? state.bankName : state.paybillAccountNumber}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  ...(state.payoutMethod === "BANK"
                    ? { bankName: e.target.value }
                    : { paybillAccountNumber: e.target.value }),
                }))
              }
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            />
          ) : null}
          {state.payoutMethod === "BANK" ? (
            <input
              type="text"
              placeholder="Bank account number"
              value={state.bankAccountNumber}
              onChange={(e) => setState((s) => ({ ...s, bankAccountNumber: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            />
          ) : null}
          {state.payoutMethod === "MPESA" ? (
            <input
              type="text"
              placeholder="M-Pesa phone number"
              value={state.mobileMoneyPhoneNumber}
              onChange={(e) => setState((s) => ({ ...s, mobileMoneyPhoneNumber: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm sm:col-span-2"
            />
          ) : null}
          {(state.payoutMethod === "TILL" || state.payoutMethod === "PAYBILL") ? (
            <>
              <input
                type="text"
                placeholder={state.payoutMethod === "TILL" ? "Till number" : "Paybill number"}
                value={state.tillPaybillNumber}
                onChange={(e) => setState((s) => ({ ...s, tillPaybillNumber: e.target.value }))}
                className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Till or paybill business name"
                value={state.tillPaybillBusinessName}
                onChange={(e) => setState((s) => ({ ...s, tillPaybillBusinessName: e.target.value }))}
                className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
              />
            </>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      <div className="rounded-xl border border-sky-400/20 bg-sky-500/5 p-4 mb-4">
        <h3 className="text-sm font-semibold mb-2">Employment documents</h3>
        <p className="text-xs text-slate-400 mb-3">
          Upload staff documents here so they appear on the employee compliance page. Use this for ID copies, contracts, licences, certificates, and related employment records.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <select
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            value={documentForm.documentType}
            onChange={(e) => setDocumentForm((s) => ({ ...s, documentType: e.target.value }))}
          >
            {EMPLOYMENT_DOCUMENT_TYPES.map((option) => (
              <option key={option} value={option}>{formatDocumentType(option)}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Document title"
            value={documentForm.title}
            onChange={(e) => setDocumentForm((s) => ({ ...s, title: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Optional notes"
            value={documentForm.notes}
            onChange={(e) => setDocumentForm((s) => ({ ...s, notes: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            type="file"
            onChange={(e) => setDocumentForm((s) => ({ ...s, file: e.target.files?.[0] ?? null }))}
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            type="button"
            onClick={uploadEmployeeDocument}
            disabled={uploadingDocument}
            className="rounded-full bg-sky-400 px-4 py-2 text-black font-semibold disabled:opacity-60"
          >
            {uploadingDocument ? "Uploading…" : "Upload document"}
          </button>
        </div>
        <div className="space-y-3">
          {employeeDocuments.length ? employeeDocuments.map((document) => (
            <div key={document.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">{formatDocumentType(document.documentType)}</div>
                  <div className="text-sm font-semibold text-white">{document.title}</div>
                  <div className="text-xs text-slate-400">
                    Uploaded {new Date(document.createdAt).toLocaleDateString("en-KE")} by {document.uploadedBy?.name || document.uploadedBy?.email || "Admin"}
                  </div>
                  {document.notes ? <div className="mt-1 text-xs text-slate-300">{document.notes}</div> : null}
                </div>
                <div className="flex gap-2">
                  <a
                    href={document.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-slate-700 px-3 py-1.5 text-xs"
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    onClick={() => void deleteEmployeeDocument(document.id)}
                    disabled={deletingDocumentId === document.id}
                    className="rounded-full border border-rose-500/40 px-3 py-1.5 text-xs text-rose-200 disabled:opacity-60"
                  >
                    {deletingDocumentId === document.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
              No employment documents uploaded yet.
            </div>
          )}
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
