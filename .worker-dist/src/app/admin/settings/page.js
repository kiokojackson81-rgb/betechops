"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminSettings;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const blankAccount = { label: "", clientId: "", refreshToken: "", shops: [] };
function AdminSettings() {
    const [accounts, setAccounts] = (0, react_1.useState)([]);
    const [accountStatus, setAccountStatus] = (0, react_1.useState)({});
    const [mergeTargets, setMergeTargets] = (0, react_1.useState)({});
    const [newAccount, setNewAccount] = (0, react_1.useState)(blankAccount);
    const [newAccountStatus, setNewAccountStatus] = (0, react_1.useState)("");
    const [j, setJ] = (0, react_1.useState)({ apiBase: "", issuer: "", clientId: "", refreshToken: "" });
    const [w, setW] = (0, react_1.useState)({ fromDay: 24, toDay: 24, adminEmails: "" });
    const [okJ, setOkJ] = (0, react_1.useState)("");
    const [okW, setOkW] = (0, react_1.useState)("");
    (0, react_1.useEffect)(() => {
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
            }
            catch (err) {
                console.error("Failed to load settings", err);
            }
        })();
    }, []);
    async function reloadAccounts() {
        try {
            const res = await fetch("/api/settings/jumia/accounts");
            if (!res.ok)
                throw new Error(await res.text());
            const data = await res.json();
            setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
            setAccountStatus({});
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unable to reload accounts";
            setAccountStatus((prev) => ({ ...prev, global: message }));
        }
    }
    async function saveExistingAccount(id) {
        const account = accounts.find((a) => a.id === id);
        if (!account)
            return;
        setAccountStatus((prev) => ({ ...prev, [id]: "Saving..." }));
        try {
            const res = await fetch("/api/settings/jumia/accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, label: account.label, clientId: account.clientId, refreshToken: account.refreshToken }),
            });
            if (!res.ok)
                throw new Error(await res.text());
            await reloadAccounts();
            setAccountStatus((prev) => ({ ...prev, [id]: "Saved" }));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unable to save";
            setAccountStatus((prev) => ({ ...prev, [id]: message }));
        }
    }
    async function discoverShops(id) {
        setAccountStatus((prev) => ({ ...prev, [id]: "Discovering shops..." }));
        try {
            const res = await fetch(`/api/settings/jumia/accounts/${id}/discover`, { method: "POST" });
            if (!res.ok)
                throw new Error(await res.text());
            const data = await res.json();
            const count = Array.isArray(data.shops) ? data.shops.length : 0;
            await reloadAccounts();
            setAccountStatus((prev) => ({ ...prev, [id]: `Discovered ${count} shop${count === 1 ? "" : "s"}` }));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Discovery failed";
            setAccountStatus((prev) => ({ ...prev, [id]: message }));
        }
    }
    async function deleteAccount(id) {
        setAccountStatus((prev) => ({ ...prev, [id]: "Deleting..." }));
        try {
            const res = await fetch(`/api/settings/jumia/accounts/${id}`, { method: "DELETE" });
            if (!res.ok)
                throw new Error(await res.text());
            await reloadAccounts();
            setAccountStatus((prev) => ({ ...prev, [id]: "Deleted" }));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Delete failed";
            setAccountStatus((prev) => ({ ...prev, [id]: message }));
        }
    }
    async function mergeAccount(sourceId) {
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
            if (!res.ok)
                throw new Error(await res.text());
            await reloadAccounts();
            setAccountStatus((prev) => ({ ...prev, [sourceId]: "Merged and deleted" }));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Merge failed";
            setAccountStatus((prev) => ({ ...prev, [sourceId]: message }));
        }
    }
    async function createAccount(e) {
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
            if (!res.ok)
                throw new Error(await res.text());
            setNewAccountStatus("Created");
            setNewAccount(blankAccount);
            await reloadAccounts();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unable to create account";
            setNewAccountStatus(message);
        }
    }
    async function saveJ(e) {
        e.preventDefault();
        setOkJ("");
        const res = await fetch("/api/settings/jumia", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(j),
        });
        setOkJ(res.ok ? "Saved" : "Failed");
    }
    async function saveW(e) {
        e.preventDefault();
        setOkW("");
        const res = await fetch("/api/settings/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(w),
        });
        setOkW(res.ok ? "Saved" : "Failed");
    }
    const Input = (p) => ((0, jsx_runtime_1.jsx)("input", { ...p, className: "w-full rounded-md bg-[#0b0e13] p-2 border border-white/10" }));
    return ((0, jsx_runtime_1.jsxs)("main", { className: "mx-auto max-w-3xl p-6 text-slate-100 space-y-10", children: [(0, jsx_runtime_1.jsxs)("header", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "mb-2 text-2xl font-semibold", children: "Settings" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Manage marketplace credentials and operations windows." })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-xl border border-white/10 bg-[#0b0e13] p-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-medium mb-2", children: "Shortcuts" }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: (0, jsx_runtime_1.jsxs)("a", { href: "/admin/settings/jumia/shipping-stations", className: "block rounded-lg border border-white/10 bg-black/20 p-4 hover:bg-white/5", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold", children: "Jumia Shipping Stations" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Set default shipping station per shop and discover providers." })] }) })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-xl border border-white/10 bg-[#0b0e13] p-4 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-medium", children: "Jumia Accounts" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Each account stores its own client and refresh token. Use Discover Shops after saving credentials." })] }), accountStatus.global && (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-red-300", children: accountStatus.global })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [accounts.map((account) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-white/10 bg-black/20 p-4 space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-base font-semibold", children: account.label || "Unnamed account" }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: accountStatus[account.id ?? ""] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400 uppercase tracking-wide", children: "Label" }), (0, jsx_runtime_1.jsx)(Input, { value: account.label, onChange: (e) => setAccounts((prev) => prev.map((acc) => acc.id === account.id ? { ...acc, label: e.target.value } : acc)) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400 uppercase tracking-wide", children: "Client ID" }), (0, jsx_runtime_1.jsx)(Input, { value: account.clientId, onChange: (e) => setAccounts((prev) => prev.map((acc) => acc.id === account.id ? { ...acc, clientId: e.target.value } : acc)) })] })] }), (0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400 uppercase tracking-wide", children: "Refresh Token" }), (0, jsx_runtime_1.jsx)(Input, { value: account.refreshToken, onChange: (e) => setAccounts((prev) => prev.map((acc) => acc.id === account.id ? { ...acc, refreshToken: e.target.value } : acc)), placeholder: "Enter refresh token" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => account.id && saveExistingAccount(account.id), className: "rounded-md bg-yellow-400 text-black px-3 py-1.5 font-medium", children: "Save" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => account.id && discoverShops(account.id), className: "rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10", children: "Discover Shops" }), accounts.length > 1 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("select", { className: "rounded-md bg-[#0b0e13] border border-white/10 px-2 py-1 text-sm", value: mergeTargets[account.id ?? ""] ?? "", onChange: (e) => setMergeTargets((prev) => ({ ...prev, [account.id ?? ""]: e.target.value })), children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Merge into..." }), accounts
                                                                .filter((a) => a.id !== account.id)
                                                                .map((a) => ((0, jsx_runtime_1.jsx)("option", { value: a.id, children: a.label || a.id }, a.id)))] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => account.id && mergeAccount(account.id), className: "rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10 text-sm", children: "Merge & Delete" })] })), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => account.id && deleteAccount(account.id), disabled: (account.shops?.length ?? 0) > 0, className: "rounded-md border border-red-400/40 text-red-300 px-3 py-1.5 hover:bg-red-400/10 disabled:opacity-50 disabled:cursor-not-allowed", title: (account.shops?.length ?? 0) > 0 ? "Transfer shops to another account before deleting" : "Delete account", children: "Delete" }), account.shops.length > 0 && ((0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-slate-300", children: [account.shops.length, " linked shop", account.shops.length === 1 ? "" : "s"] }))] }), account.shops.length > 0 && ((0, jsx_runtime_1.jsx)("ul", { className: "list-disc list-inside text-sm text-slate-400", children: account.shops.map((shop) => ((0, jsx_runtime_1.jsxs)("li", { children: [shop.name, " (", shop.id, ")"] }, shop.id))) }))] }, account.id))), (0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-dashed border-white/10 p-4", children: (0, jsx_runtime_1.jsxs)("form", { onSubmit: createAccount, className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-base font-semibold", children: "Add Account" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400 uppercase tracking-wide", children: "Label" }), (0, jsx_runtime_1.jsx)(Input, { value: newAccount.label, onChange: (e) => setNewAccount((prev) => ({ ...prev, label: e.target.value })) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400 uppercase tracking-wide", children: "Client ID" }), (0, jsx_runtime_1.jsx)(Input, { value: newAccount.clientId, onChange: (e) => setNewAccount((prev) => ({ ...prev, clientId: e.target.value })) })] })] }), (0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400 uppercase tracking-wide", children: "Refresh Token" }), (0, jsx_runtime_1.jsx)(Input, { value: newAccount.refreshToken, onChange: (e) => setNewAccount((prev) => ({ ...prev, refreshToken: e.target.value })) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("button", { type: "submit", className: "rounded-md bg-yellow-400 text-black px-3 py-1.5 font-medium", children: "Create" }), newAccountStatus && (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-300", children: newAccountStatus })] })] }) })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-xl border border-white/10 bg-[#0b0e13] p-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "mb-3 text-lg font-medium", children: "Jumia API (Global)" }), (0, jsx_runtime_1.jsxs)("form", { onSubmit: saveJ, className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "API Base URL" }), (0, jsx_runtime_1.jsx)(Input, { value: j.apiBase, onChange: (e) => setJ((v) => ({ ...v, apiBase: e.target.value })) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "OIDC Issuer" }), (0, jsx_runtime_1.jsx)(Input, { value: j.issuer, onChange: (e) => setJ((v) => ({ ...v, issuer: e.target.value })) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Client ID" }), (0, jsx_runtime_1.jsx)(Input, { value: j.clientId, onChange: (e) => setJ((v) => ({ ...v, clientId: e.target.value })) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Refresh Token" }), (0, jsx_runtime_1.jsx)(Input, { value: j.refreshToken, onChange: (e) => setJ((v) => ({ ...v, refreshToken: e.target.value })) })] }), (0, jsx_runtime_1.jsx)("button", { className: "rounded-md bg-yellow-400 text-black px-4 py-2 font-medium", children: "Save" }), okJ && (0, jsx_runtime_1.jsx)("span", { className: "ml-3 text-sm text-slate-300", children: okJ })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-xl border border-white/10 bg-[#0b0e13] p-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "mb-3 text-lg font-medium", children: "Commission Window" }), (0, jsx_runtime_1.jsxs)("form", { onSubmit: saveW, className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "From Day (1-28)" }), (0, jsx_runtime_1.jsx)(Input, { type: "number", min: 1, max: 28, value: w.fromDay, onChange: (e) => setW((v) => ({ ...v, fromDay: Number(e.target.value) })) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "To Day (1-28)" }), (0, jsx_runtime_1.jsx)(Input, { type: "number", min: 1, max: 28, value: w.toDay, onChange: (e) => setW((v) => ({ ...v, toDay: Number(e.target.value) })) })] })] }), (0, jsx_runtime_1.jsxs)("label", { className: "block", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Admin Emails (comma separated)" }), (0, jsx_runtime_1.jsx)(Input, { value: w.adminEmails, onChange: (e) => setW((v) => ({ ...v, adminEmails: e.target.value })) })] }), (0, jsx_runtime_1.jsx)("button", { className: "rounded-md bg-yellow-400 text-black px-4 py-2 font-medium", children: "Save" }), okW && (0, jsx_runtime_1.jsx)("span", { className: "ml-3 text-sm text-slate-300", children: okW })] })] })] }));
}
