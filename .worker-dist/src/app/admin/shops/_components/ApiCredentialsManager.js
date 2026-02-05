"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ApiCredentialsManager;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const toast_1 = require("@/lib/ui/toast");
function ApiCredentialsManager() {
    const [creds, setCreds] = (0, react_1.useState)([]);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [form, setForm] = (0, react_1.useState)({ scope: 'GLOBAL', apiBase: '', apiKey: '', apiSecret: '', shopId: '' });
    const [msg, setMsg] = (0, react_1.useState)(null);
    async function load() {
        const res = await fetch('/api/credentials');
        if (!res.ok)
            return;
        const j = await res.json();
        setCreds(j || []);
    }
    (0, react_1.useEffect)(() => { load(); }, []);
    const [editingId, setEditingId] = (0, react_1.useState)(null);
    async function create() {
        setBusy(true);
        setMsg(null);
        try {
            const method = editingId ? 'PATCH' : 'POST';
            const url = editingId ? `/api/credentials/${editingId}` : '/api/credentials';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
            const j = await res.json();
            if (!res.ok)
                throw new Error(j?.error || 'failed');
            (0, toast_1.showToast)(editingId ? 'Updated' : 'Saved', 'success');
            setForm({ scope: 'GLOBAL', apiBase: '', apiKey: '', apiSecret: '', shopId: '' });
            setEditingId(null);
            await load();
        }
        catch (err) {
            const m = err instanceof Error ? err.message : String(err);
            setMsg(m);
            (0, toast_1.showToast)(m, 'error');
        }
        finally {
            setBusy(false);
        }
    }
    async function remove(id) {
        // two-step delete: set pending state requiring a second click to confirm
        if (editingId !== id) {
            setEditingId(id);
            (0, toast_1.showToast)('Click delete again to confirm deletion', 'warn');
            return;
        }
        const res = await fetch(`/api/credentials/${id}`, { method: 'DELETE' });
        if (res.ok) {
            (0, toast_1.showToast)('Deleted', 'success');
            setEditingId(null);
            load();
        }
        else {
            (0, toast_1.showToast)('Delete failed', 'error');
        }
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "p-2 border rounded", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold", children: "Create API Credential" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 mt-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block", children: "Scope" }), (0, jsx_runtime_1.jsxs)("select", { value: form.scope, onChange: e => setForm(f => ({ ...f, scope: e.target.value })), className: "border p-1", children: [(0, jsx_runtime_1.jsx)("option", { children: "GLOBAL" }), (0, jsx_runtime_1.jsx)("option", { children: "SHOP" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block", children: "API Base" }), (0, jsx_runtime_1.jsx)("input", { value: form.apiBase, onChange: e => setForm(f => ({ ...f, apiBase: e.target.value })), className: "border p-1 w-full" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block", children: "API Key" }), (0, jsx_runtime_1.jsx)("input", { value: form.apiKey, onChange: e => setForm(f => ({ ...f, apiKey: e.target.value })), className: "border p-1 w-full" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block", children: "Shop ID (optional)" }), (0, jsx_runtime_1.jsx)("input", { value: form.shopId, onChange: e => setForm(f => ({ ...f, shopId: e.target.value })), className: "border p-1 w-full" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("button", { className: "px-3 py-1 bg-blue-600 text-white", onClick: create, disabled: busy, children: "Save" }), msg && (0, jsx_runtime_1.jsx)("span", { className: "ml-2 text-sm", children: msg })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-2 border rounded", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold", children: "Existing Credentials" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 space-y-2", children: creds.map(c => ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "font-medium", children: [c.scope, " ", c.shopId ? `(${c.shopId})` : ''] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-slate-500", children: [c.apiBase, " ", c.apiKey ? '•' : ''] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("button", { className: "px-2 py-1 mr-2", onClick: () => { setForm({ scope: c.scope, apiBase: c.apiBase || '', apiKey: c.apiKey || '', apiSecret: c.apiSecret || '', shopId: c.shopId || '' }); setEditingId(c.id); (0, toast_1.showToast)('Editing credential', 'info'); }, children: "Edit" }), (0, jsx_runtime_1.jsx)("button", { className: "px-2 py-1 text-red-600", onClick: () => remove(c.id), children: editingId === c.id ? 'Confirm Delete' : 'Delete' })] })] }, c.id))) })] })] }));
}
