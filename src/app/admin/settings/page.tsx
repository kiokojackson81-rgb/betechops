"use client";
import { useEffect, useState } from "react";

type JumiaForm = {
  apiBase: string;
  issuer: string;
  clientId: string;
  refreshToken: string;
};

type WindowForm = {
  fromDay: number;
  toDay: number;
  adminEmails: string;
};

type AccountForm = {
  id?: string;
  label: string;
  clientId: string;
  refreshToken: string;
  shops: { id: string; name: string }[];
};

const blankAccount: AccountForm = { label: "", clientId: "", refreshToken: "", shops: [] };

export default function AdminSettings() {
  const [accounts, setAccounts] = useState<AccountForm[]>([]);
  const [accountStatus, setAccountStatus] = useState<Record<string, string>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [newAccount, setNewAccount] = useState<AccountForm>(blankAccount);
  const [newAccountStatus, setNewAccountStatus] = useState("");

  const [j, setJ] = useState<JumiaForm>({ apiBase: "", issuer: "", clientId: "", refreshToken: "" });
  const [w, setW] = useState<WindowForm>({ fromDay: 24, toDay: 24, adminEmails: "" });
  const [okJ, setOkJ] = useState("");
  const [okW, setOkW] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [jumiaRes, windowRes, accountsRes] = await Promise.all([
          fetch("/api/settings/jumia"),
          fetch("/api/settings/config"),
          fetch("/api/settings/jumia/accounts"),
        ]);
        if (jumiaRes.ok) {
          const data = await jumiaRes.json();
          setJ({
            apiBase: String(data.apiBase ?? ""),
            issuer: String(data.issuer ?? ""),
            clientId: String(data.clientId ?? ""),
            refreshToken: "",
          });
        }
        if (windowRes.ok) {
          const data = await windowRes.json();
          setW({
            fromDay: Number(data.fromDay ?? 24),
            toDay: Number(data.toDay ?? 24),
            adminEmails: String(data.adminEmails ?? ""),
          });
        }
        if (accountsRes.ok) {
          const data = await accountsRes.json();
          setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    })();
  }, []);

  async function reloadAccounts() {
    try {
      const res = await fetch("/api/settings/jumia/accounts");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      setAccountStatus({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reload accounts";
      setAccountStatus((prev) => ({ ...prev, global: message }));
    }
  }

  async function saveExistingAccount(id: string) {
    const account = accounts.find((a) => a.id === id);
    if (!account) return;
    setAccountStatus((prev) => ({ ...prev, [id]: "Saving..." }));
    try {
      const res = await fetch("/api/settings/jumia/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, label: account.label, clientId: account.clientId, refreshToken: account.refreshToken }),
      });
      if (!res.ok) throw new Error(await res.text());
      await reloadAccounts();
      setAccountStatus((prev) => ({ ...prev, [id]: "Saved" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save";
      setAccountStatus((prev) => ({ ...prev, [id]: message }));
    }
  }

  async function discoverShops(id: string) {
    setAccountStatus((prev) => ({ ...prev, [id]: "Discovering shops..." }));
    try {
      const res = await fetch(`/api/settings/jumia/accounts/${id}/discover`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const count = Array.isArray(data.shops) ? data.shops.length : 0;
      await reloadAccounts();
      setAccountStatus((prev) => ({ ...prev, [id]: `Discovered ${count} shop${count === 1 ? "" : "s"}` }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Discovery failed";
      setAccountStatus((prev) => ({ ...prev, [id]: message }));
    }
  }

  async function deleteAccount(id: string) {
    setAccountStatus((prev) => ({ ...prev, [id]: "Deleting..." }));
    try {
      const res = await fetch(`/api/settings/jumia/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await reloadAccounts();
      setAccountStatus((prev) => ({ ...prev, [id]: "Deleted" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed";
      setAccountStatus((prev) => ({ ...prev, [id]: message }));
    }
  }

  async function mergeAccount(sourceId: string) {
    const targetId = mergeTargets[sourceId];
    if (!targetId) {
      setAccountStatus((prev) => ({ ...prev, [sourceId]: "Select target account" }));
      return;
    }
    setAccountStatus((prev) => ({ ...prev, [sourceId]: "Merging (moving shops)..." }));
    try {
      const res = await fetch(`/api/settings/jumia/accounts/${sourceId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAccountId: targetId, deleteSource: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      await reloadAccounts();
      setAccountStatus((prev) => ({ ...prev, [sourceId]: "Merged and deleted" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Merge failed";
      setAccountStatus((prev) => ({ ...prev, [sourceId]: message }));
    }
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newAccount.label || !newAccount.clientId || !newAccount.refreshToken) {
      setNewAccountStatus("Label, Client ID, and Refresh Token are required");
      return;
    }
    setNewAccountStatus("Saving...");
    try {
      const res = await fetch("/api/settings/jumia/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newAccount.label,
          clientId: newAccount.clientId,
          refreshToken: newAccount.refreshToken,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewAccountStatus("Created");
      setNewAccount(blankAccount);
      await reloadAccounts();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create account";
      setNewAccountStatus(message);
    }
  }

  async function saveJ(e: React.FormEvent) {
    e.preventDefault();
    setOkJ("");
    const res = await fetch("/api/settings/jumia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(j),
    });
    setOkJ(res.ok ? "Saved" : "Failed");
  }

  async function saveW(e: React.FormEvent) {
    e.preventDefault();
    setOkW("");
    const res = await fetch("/api/settings/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(w),
    });
    setOkW(res.ok ? "Saved" : "Failed");
  }

  const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...p} className="w-full rounded-md bg-[#0b0e13] p-2 border border-white/10" />
  );

  return (
    <main className="mx-auto max-w-3xl p-6 text-slate-100 space-y-10">
      <header>
        <h1 className="mb-2 text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-400">Manage marketplace credentials and operations windows.</p>
      </header>

      {/* Quick links */}
      <section className="rounded-xl border border-white/10 bg-[#0b0e13] p-4">
        <h2 className="text-lg font-medium mb-2">Shortcuts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="/admin/settings/jumia/shipping-stations"
            className="block rounded-lg border border-white/10 bg-black/20 p-4 hover:bg-white/5"
          >
            <div className="font-semibold">Jumia Shipping Stations</div>
            <div className="text-sm text-slate-400">Set default shipping station per shop and discover providers.</div>
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#0b0e13] p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Jumia Accounts</h2>
            <p className="text-sm text-slate-400">Each account stores its own client and refresh token. Use Discover Shops after saving credentials.</p>
          </div>
          {accountStatus.global && <span className="text-sm text-red-300">{accountStatus.global}</span>}
        </div>

        <div className="space-y-4">
          {accounts.map((account) => (
            <div key={account.id} className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{account.label || "Unnamed account"}</h3>
                <span className="text-xs text-slate-400">{accountStatus[account.id ?? ""]}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Label</div>
                  <Input
                    value={account.label}
                    onChange={(e) => setAccounts((prev) => prev.map((acc) => acc.id === account.id ? { ...acc, label: e.target.value } : acc))}
                  />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Client ID</div>
                  <Input
                    value={account.clientId}
                    onChange={(e) => setAccounts((prev) => prev.map((acc) => acc.id === account.id ? { ...acc, clientId: e.target.value } : acc))}
                  />
                </label>
              </div>
              <label className="block">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Refresh Token</div>
                <Input
                  value={account.refreshToken}
                  onChange={(e) => setAccounts((prev) => prev.map((acc) => acc.id === account.id ? { ...acc, refreshToken: e.target.value } : acc))}
                  placeholder="Enter refresh token"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => account.id && saveExistingAccount(account.id)}
                  className="rounded-md bg-yellow-400 text-black px-3 py-1.5 font-medium"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => account.id && discoverShops(account.id)}
                  className="rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10"
                >
                  Discover Shops
                </button>
                {/* Merge controls */}
                {accounts.length > 1 && (
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-md bg-[#0b0e13] border border-white/10 px-2 py-1 text-sm"
                      value={mergeTargets[account.id ?? ""] ?? ""}
                      onChange={(e) => setMergeTargets((prev) => ({ ...prev, [account.id ?? ""]: e.target.value }))}
                    >
                      <option value="">Merge into...</option>
                      {accounts
                        .filter((a) => a.id !== account.id)
                        .map((a) => (
                          <option key={a.id} value={a.id}>{a.label || a.id}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => account.id && mergeAccount(account.id)}
                      className="rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10 text-sm"
                    >
                      Merge & Delete
                    </button>
                  </div>
                )}
                {/* Delete account (only if no shops) */}
                <button
                  type="button"
                  onClick={() => account.id && deleteAccount(account.id)}
                  disabled={(account.shops?.length ?? 0) > 0}
                  className="rounded-md border border-red-400/40 text-red-300 px-3 py-1.5 hover:bg-red-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={(account.shops?.length ?? 0) > 0 ? "Transfer shops to another account before deleting" : "Delete account"}
                >
                  Delete
                </button>
                {account.shops.length > 0 && (
                  <span className="text-xs text-slate-300">{account.shops.length} linked shop{account.shops.length === 1 ? "" : "s"}</span>
                )}
              </div>
              {account.shops.length > 0 && (
                <ul className="list-disc list-inside text-sm text-slate-400">
                  {account.shops.map((shop) => (
                    <li key={shop.id}>{shop.name} ({shop.id})</li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="rounded-lg border border-dashed border-white/10 p-4">
            <form onSubmit={createAccount} className="space-y-3">
              <h3 className="text-base font-semibold">Add Account</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Label</div>
                  <Input value={newAccount.label} onChange={(e) => setNewAccount((prev) => ({ ...prev, label: e.target.value }))} />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Client ID</div>
                  <Input value={newAccount.clientId} onChange={(e) => setNewAccount((prev) => ({ ...prev, clientId: e.target.value }))} />
                </label>
              </div>
              <label className="block">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Refresh Token</div>
                <Input value={newAccount.refreshToken} onChange={(e) => setNewAccount((prev) => ({ ...prev, refreshToken: e.target.value }))} />
              </label>
              <div className="flex items-center gap-3">
                <button type="submit" className="rounded-md bg-yellow-400 text-black px-3 py-1.5 font-medium">Create</button>
                {newAccountStatus && <span className="text-xs text-slate-300">{newAccountStatus}</span>}
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#0b0e13] p-4">
        <h2 className="mb-3 text-lg font-medium">Jumia API (Global)</h2>
        <form onSubmit={saveJ} className="space-y-3">
          <label className="block">
            <div className="text-sm text-slate-400">API Base URL</div>
            <Input value={j.apiBase} onChange={(e) => setJ((v) => ({ ...v, apiBase: e.target.value }))} />
          </label>
          <label className="block">
            <div className="text-sm text-slate-400">OIDC Issuer</div>
            <Input value={j.issuer} onChange={(e) => setJ((v) => ({ ...v, issuer: e.target.value }))} />
          </label>
          <label className="block">
            <div className="text-sm text-slate-400">Client ID</div>
            <Input value={j.clientId} onChange={(e) => setJ((v) => ({ ...v, clientId: e.target.value }))} />
          </label>
          <label className="block">
            <div className="text-sm text-slate-400">Refresh Token</div>
            <Input value={j.refreshToken} onChange={(e) => setJ((v) => ({ ...v, refreshToken: e.target.value }))} />
          </label>
          <button className="rounded-md bg-yellow-400 text-black px-4 py-2 font-medium">Save</button>
          {okJ && <span className="ml-3 text-sm text-slate-300">{okJ}</span>}
        </form>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#0b0e13] p-4">
        <h2 className="mb-3 text-lg font-medium">Commission Window</h2>
        <form onSubmit={saveW} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="text-sm text-slate-400">From Day (1-28)</div>
              <Input type="number" min={1} max={28} value={w.fromDay} onChange={(e) => setW((v) => ({ ...v, fromDay: Number(e.target.value) }))} />
            </label>
            <label className="block">
              <div className="text-sm text-slate-400">To Day (1-28)</div>
              <Input type="number" min={1} max={28} value={w.toDay} onChange={(e) => setW((v) => ({ ...v, toDay: Number(e.target.value) }))} />
            </label>
          </div>
          <label className="block">
            <div className="text-sm text-slate-400">Admin Emails (comma separated)</div>
            <Input value={w.adminEmails} onChange={(e) => setW((v) => ({ ...v, adminEmails: e.target.value }))} />
          </label>
          <button className="rounded-md bg-yellow-400 text-black px-4 py-2 font-medium">Save</button>
          {okW && <span className="ml-3 text-sm text-slate-300">{okW}</span>}
        </form>
      </section>
    </main>
  );
}
