"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import getLandingPage, { getAdminLandingPage } from "@/lib/getLandingPage";
import { TECHNICAL_PERMISSION_SCOPES, TECHNICAL_TEAM_ROLE_OPTIONS } from "@/lib/technicalTeam";
type AttendantRow = {
  id: string;
  name: string | null;
  email: string;
  attendantCategory: string | null;
  categoryLabel?: string;
  isActive: boolean;
  createdAt?: string;
};

type CreateFormState = {
  name: string;
  email: string;
  phone: string;
  password: string;
  category: string;
  baseSalary: string;
  isActive: boolean;
  positionTitle: string;
  teamRole: string;
  employeeNumber: string;
  epraLicenseNumber: string;
  epraLicenseClass: string;
  drivingLicenseDetails: string;
  employmentDate: string;
  permissionScope: string;
};

export default function AttendantsClient({ attendants }: { attendants: AttendantRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<AttendantRow[]>(attendants);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>({
    name: "",
    email: "",
    phone: "",
    password: "",
    category: "GENERAL_OPS",
    baseSalary: "",
    isActive: true,
    positionTitle: "",
    teamRole: "",
    employeeNumber: "",
    epraLicenseNumber: "",
    epraLicenseClass: "",
    drivingLicenseDetails: "",
    employmentDate: "",
    permissionScope: TECHNICAL_PERMISSION_SCOPES[2],
  });
  const [filterCategory, setFilterCategory] = useState<any>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "DISABLED">("ALL");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = rows.filter((a) => {
    if (filterCategory !== "ALL") {
      const rowCategory = String(a.attendantCategory ?? "").toUpperCase();
      const wanted = String(filterCategory ?? "").toUpperCase();
      const rowNormalized = rowCategory === "BETECH_OPS" ? "GENERAL_OPS" : rowCategory;
      const wantedNormalized = wanted === "BETECH_OPS" ? "GENERAL_OPS" : wanted;
      if (rowNormalized !== wantedNormalized) return false;
    }
    if (filterStatus === "ACTIVE" && !a.isActive) return false;
    if (filterStatus === "DISABLED" && a.isActive) return false;
    return true;
  });

  async function createUser() {
    const email = createForm.email.trim().toLowerCase();
    const name = createForm.name.trim();
    const phone = createForm.phone.trim();
    const password = createForm.password;
    const baseSalary = Number(createForm.baseSalary || 0);
    if (!email) return alert("Email is required");
    if (!password || password.length < 6) return alert("Password must be at least 6 characters");
    if (!Number.isFinite(baseSalary) || baseSalary < 0) return alert("Base salary must be a valid number");

    setCreating(true);
    try {
      const createRes = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          phone: phone || undefined,
          role: "ATTENDANT",
          category: createForm.category,
          categories: [createForm.category],
        }),
      });
      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !createJson?.user?.id) {
        throw new Error(String(createJson?.error || "Failed to create user"));
      }

      const userId = String(createJson.user.id);

      const passwordRes = await fetch(`/api/users/${userId}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!passwordRes.ok) {
        const passwordJson = await passwordRes.json().catch(() => ({}));
        throw new Error(String(passwordJson?.error || "Failed to set password"));
      }

      const planRes = await fetch(`/api/admin/attendants/${userId}/comp-plan`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseSalary, frequency: "PERIOD" }),
      });
      if (!planRes.ok) {
        const planJson = await planRes.json().catch(() => ({}));
        throw new Error(String(planJson?.error || "Failed to save salary"));
      }

      if (!createForm.isActive) {
        await fetch(`/api/admin/attendants/${userId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "deactivate" }),
        });
      }

      if (createForm.category === "TECHNICAL_TEAM") {
        const technicalRes = await fetch(`/api/admin/technical-team/${userId}/profile`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            teamRole: createForm.teamRole || null,
            positionTitle: createForm.positionTitle || null,
            employeeNumber: createForm.employeeNumber || null,
            phoneNumber: phone || null,
            epraLicenseNumber: createForm.epraLicenseNumber || null,
            epraLicenseClass: createForm.epraLicenseClass || null,
            drivingLicenseDetails: createForm.drivingLicenseDetails || null,
            employmentDate: createForm.employmentDate || null,
            activeAccount: createForm.isActive,
            permissionScope: createForm.permissionScope || null,
          }),
        });
        if (!technicalRes.ok) {
          const technicalJson = await technicalRes.json().catch(() => ({}));
          throw new Error(String(technicalJson?.error || "Failed to save technical team profile"));
        }
      }

      setCreateForm({
        name: "",
        email: "",
        phone: "",
        password: "",
        category: "GENERAL_OPS",
        baseSalary: "",
        isActive: true,
        positionTitle: "",
        teamRole: "",
        employeeNumber: "",
        epraLicenseNumber: "",
        epraLicenseClass: "",
        drivingLicenseDetails: "",
        employmentDate: "",
        permissionScope: TECHNICAL_PERMISSION_SCOPES[2],
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

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
            <option value="GENERAL_OPS">General User Ops</option>
            <option value="DIRECT_SALES_OPS">Direct Sales Ops</option>
            <option value="MARKETING_OPS">Marketing Ops</option>
            <option value="JUMIA_KILIMALL_OPS">Jumia / Kilimall Ops</option>
            <option value="SUPPORT_OPS">Support Ops</option>
            <option value="TECHNICAL_TEAM">Technical Team</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Create user</h2>
          <p className="text-xs text-slate-400">
            Use <strong>General User Ops</strong> for the tracker-style dashboard and payroll/commission flow.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            placeholder="Full name"
            value={createForm.name}
            onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            placeholder="Phone number"
            value={createForm.phone}
            onChange={(e) => setCreateForm((s) => ({ ...s, phone: e.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            placeholder="Password (min 6)"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))}
          />
          <select
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            value={createForm.category}
            onChange={(e) => setCreateForm((s) => ({ ...s, category: e.target.value }))}
          >
            <option value="GENERAL_OPS">General User Ops</option>
            <option value="DIRECT_SALES_OPS">Direct Sales Ops</option>
            <option value="MARKETING_OPS">Marketing Ops</option>
            <option value="JUMIA_KILIMALL_OPS">Jumia / Kilimall Ops</option>
            <option value="SUPPORT_OPS">Support Ops</option>
            <option value="TECHNICAL_TEAM">Technical Team</option>
          </select>
          <input
            className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
            placeholder="Base salary (KES)"
            type="number"
            min="0"
            value={createForm.baseSalary}
            onChange={(e) => setCreateForm((s) => ({ ...s, baseSalary: e.target.value }))}
          />
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={createForm.isActive}
              onChange={(e) => setCreateForm((s) => ({ ...s, isActive: e.target.checked }))}
            />
            Active account
          </label>
        </div>
        {createForm.category === "TECHNICAL_TEAM" ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-emerald-100">Technical team profile</h3>
              <p className="text-xs text-slate-400">These fields power the dedicated technical dashboard and staff profile.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
                value={createForm.teamRole}
                onChange={(e) =>
                  setCreateForm((s) => ({
                    ...s,
                    teamRole: e.target.value,
                    positionTitle: s.positionTitle || e.target.value,
                  }))
                }
              >
                <option value="">Select team role</option>
                {TECHNICAL_TEAM_ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
                placeholder="Position / job title"
                value={createForm.positionTitle}
                onChange={(e) => setCreateForm((s) => ({ ...s, positionTitle: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
                placeholder="Employee number"
                value={createForm.employeeNumber}
                onChange={(e) => setCreateForm((s) => ({ ...s, employeeNumber: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
                placeholder="EPRA licence number"
                value={createForm.epraLicenseNumber}
                onChange={(e) => setCreateForm((s) => ({ ...s, epraLicenseNumber: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
                placeholder="Licence class"
                value={createForm.epraLicenseClass}
                onChange={(e) => setCreateForm((s) => ({ ...s, epraLicenseClass: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
                placeholder="Driving licence details"
                value={createForm.drivingLicenseDetails}
                onChange={(e) => setCreateForm((s) => ({ ...s, drivingLicenseDetails: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
                type="date"
                value={createForm.employmentDate}
                onChange={(e) => setCreateForm((s) => ({ ...s, employmentDate: e.target.value }))}
              />
              <select
                className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
                value={createForm.permissionScope}
                onChange={(e) => setCreateForm((s) => ({ ...s, permissionScope: e.target.value }))}
              >
                {TECHNICAL_PERMISSION_SCOPES.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
        <div className="mt-3">
          <button
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
            disabled={creating}
            onClick={() => void createUser()}
          >
            {creating ? "Creating..." : "Create user"}
          </button>
        </div>
      </section>

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
                      href={`${getAdminLandingPage(a.attendantCategory)}?impersonateId=${a.id}`}
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
                    href={`${getAdminLandingPage(a.attendantCategory)}?impersonateId=${a.id}`}
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
                    <Link
                      href={`/admin/attendants/${a.id}`}
                      className="text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/admin/attendants/${a.id}/payroll`}
                      className="text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800"
                    >
                      Payroll
                    </Link>
                    <a
                      href={`/api/attendant/daily-report/performance-receipt/pdf?impersonateId=${encodeURIComponent(a.id)}&ts=${Date.now()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs rounded-full border border-emerald-700 px-3 py-1 text-emerald-200 hover:bg-slate-800 inline-flex items-center justify-center"
                    >
                      Performance PDF
                    </a>
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
