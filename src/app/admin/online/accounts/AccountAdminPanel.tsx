"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import MarketplaceAssignmentRole, { MarketplaceAssignmentRoleValues, type MarketplaceAssignmentRole as MarketplaceAssignmentRoleType } from "@/lib/marketplaceAssignment";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/ui/toast";

type Platform = "JUMIA" | "KILIMALL";

const PLATFORM = {
  JUMIA: "JUMIA",
  KILIMALL: "KILIMALL",
} as const;

type AccountOption = {
  id: string;
  displayName: string;
  platform: Platform;
};

type AttendantOption = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  attendantCategory: string | null;
};

type Props = {
  accounts: AccountOption[];
  attendants: AttendantOption[];
};

const inputClasses =
  "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400";

export function AccountAdminPanel({ accounts, attendants }: Props) {
  const router = useRouter();
  const [isCreating, startCreating] = useTransition();
  const [isAssigning, startAssigning] = useTransition();
  const [accountForm, setAccountForm] = useState({
    platform: PLATFORM.JUMIA as Platform,
    displayName: "",
    countryCode: "KE",
    currency: "KES",
    jumiaShopSid: "",
    kilimallShopCode: "",
    isActive: true,
  });
  const [assignmentForm, setAssignmentForm] = useState({
    accountId: accounts[0]?.id ?? "",
    attendantId: "",
    role: MarketplaceAssignmentRole.JUMIA_KILIMALL_OPS as MarketplaceAssignmentRoleType,
    endsAt: "",
  });

  const platformOptions = useMemo(() => Object.values(PLATFORM), []);
  const assignmentRoles = useMemo(() => MarketplaceAssignmentRoleValues, []);

  useEffect(() => {
    if (accounts.length === 0) {
      if (assignmentForm.accountId) {
        setAssignmentForm((prev) => ({ ...prev, accountId: "" }));
      }
      return;
    }
    const exists = accounts.some((account) => account.id === assignmentForm.accountId);
    if (!assignmentForm.accountId || !exists) {
      setAssignmentForm((prev) => ({ ...prev, accountId: accounts[0].id }));
    }
  }, [accounts, assignmentForm.accountId]);

  const handleCreateAccount = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accountForm.displayName.trim()) {
      showToast("Display name is required", "error");
      return;
    }
    if (!accountForm.countryCode.trim()) {
      showToast("Country code is required", "error");
      return;
    }
    startCreating(async () => {
      try {
        const payload = {
          platform: accountForm.platform,
          displayName: accountForm.displayName.trim(),
          countryCode: accountForm.countryCode.trim().toUpperCase(),
          currency: accountForm.currency.trim().toUpperCase(),
          jumiaShopSid:
            accountForm.platform === PLATFORM.JUMIA && accountForm.jumiaShopSid.trim()
              ? accountForm.jumiaShopSid.trim()
              : undefined,
          kilimallShopCode:
            accountForm.platform === PLATFORM.KILIMALL && accountForm.kilimallShopCode.trim()
              ? accountForm.kilimallShopCode.trim()
              : undefined,
          isActive: accountForm.isActive,
        };

        const res = await fetch("/api/admin/online/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to create account");
        }

        showToast("Marketplace account saved", "success");
        setAccountForm((prev) => ({
          ...prev,
          displayName: "",
          jumiaShopSid: "",
          kilimallShopCode: "",
        }));
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save account";
        showToast(message, "error");
      }
    });
  };

  const handleAssign = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignmentForm.accountId) {
      showToast("Select an account", "error");
      return;
    }
    if (!assignmentForm.attendantId) {
      showToast("Select an attendant", "error");
      return;
    }
    startAssigning(async () => {
      try {
        const payload = {
          accountId: assignmentForm.accountId,
          attendantId: assignmentForm.attendantId,
          role: assignmentForm.role,
          endsAt: assignmentForm.endsAt ? new Date(assignmentForm.endsAt).toISOString() : null,
        };

        const res = await fetch("/api/admin/online/accounts/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to assign attendant");
        }

        showToast("Assignment updated", "success");
        setAssignmentForm((prev) => ({ ...prev, attendantId: "", endsAt: "" }));
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to assign attendant";
        showToast(message, "error");
      }
    });
  };

  const disableAssignment = accounts.length === 0 || attendants.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-lg font-semibold text-white">Create / update marketplace account</h3>
        <p className="mt-1 text-sm text-slate-400">
          Add new Jumia or Kilimall accounts so their payout weeks, orders and returns appear in the dashboards.
        </p>
        <form className="mt-4 space-y-4" onSubmit={handleCreateAccount}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-200">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Platform</span>
              <select
                className={inputClasses}
                value={accountForm.platform}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, platform: e.target.value as Platform }))}
              >
                {platformOptions.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-200">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Display name</span>
              <input
                className={inputClasses}
                value={accountForm.displayName}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder="eg. Jumia - Wild Tech"
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm text-slate-200">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Country</span>
              <input
                className={inputClasses}
                value={accountForm.countryCode}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, countryCode: e.target.value }))}
                placeholder="KE"
              />
            </label>
            <label className="text-sm text-slate-200">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Currency</span>
              <input
                className={inputClasses}
                value={accountForm.currency}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, currency: e.target.value }))}
                placeholder="KES"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={accountForm.isActive}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900"
              />
              <span>Active</span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-200">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Jumia shop SID</span>
              <input
                className={`${inputClasses} ${accountForm.platform === PLATFORM.JUMIA ? "" : "opacity-50"}`}
                value={accountForm.jumiaShopSid}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, jumiaShopSid: e.target.value }))}
                placeholder="e.g. shop_12345"
                disabled={accountForm.platform !== PLATFORM.JUMIA}
              />
            </label>
            <label className="text-sm text-slate-200">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Kilimall shop code</span>
              <input
                className={`${inputClasses} ${accountForm.platform === PLATFORM.KILIMALL ? "" : "opacity-50"}`}
                value={accountForm.kilimallShopCode}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, kilimallShopCode: e.target.value }))}
                placeholder="e.g. KLM-WILD01"
                disabled={accountForm.platform !== PLATFORM.KILIMALL}
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isCreating}
              className="inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
            >
              {isCreating ? "Saving..." : "Save account"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-lg font-semibold text-white">Attach attendants to accounts</h3>
        <p className="mt-1 text-sm text-slate-400">
          Assign attendants or supervisors so pricing queues, payouts and returns are scoped to their accounts.
        </p>
        <form className="mt-4 space-y-4" onSubmit={handleAssign}>
          <label className="text-sm text-slate-200">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Account</span>
            <select
              className={inputClasses}
              value={assignmentForm.accountId}
              onChange={(e) => setAssignmentForm((prev) => ({ ...prev, accountId: e.target.value }))}
              disabled={accounts.length === 0}
            >
              <option value="" disabled>
                {accounts.length === 0 ? "No accounts yet" : "Select account"}
              </option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName} ({account.platform})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-200">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Attendant / supervisor</span>
            <select
              className={inputClasses}
              value={assignmentForm.attendantId}
              onChange={(e) => setAssignmentForm((prev) => ({ ...prev, attendantId: e.target.value }))}
              disabled={attendants.length === 0}
            >
              <option value="" disabled>
                {attendants.length === 0 ? "No attendants found" : "Select attendant"}
              </option>
              {attendants.map((attendant) => (
                <option key={attendant.id} value={attendant.id}>
                  {attendant.name ?? attendant.email ?? attendant.id} · {attendant.role}
                  {attendant.attendantCategory ? ` / ${attendant.attendantCategory}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-200">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Role</span>
              <select
                className={inputClasses}
                value={assignmentForm.role}
                onChange={(e) =>
                  setAssignmentForm((prev) => ({ ...prev, role: e.target.value as MarketplaceAssignmentRoleType }))
                }
                disabled={disableAssignment}
              >
                {assignmentRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-200">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Ends at (optional)</span>
              <input
                type="date"
                className={inputClasses}
                value={assignmentForm.endsAt}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                disabled={disableAssignment}
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={disableAssignment || isAssigning}
              className="inline-flex items-center rounded-xl border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-60"
            >
              {isAssigning ? "Assigning..." : "Save assignment"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
