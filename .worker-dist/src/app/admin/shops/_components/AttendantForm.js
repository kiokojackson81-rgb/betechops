"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantForm;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const toast_1 = require("@/lib/ui/toast");
const ShopsActionsContext_1 = require("./ShopsActionsContext");
const definitions_1 = require("@/lib/attendants/definitions");
function AttendantForm({ shops }) {
    const [email, setEmail] = (0, react_1.useState)('');
    const [name, setName] = (0, react_1.useState)('');
    const [shopId, setShopId] = (0, react_1.useState)('');
    const [roleAtShop, setRoleAtShop] = (0, react_1.useState)('ATTENDANT');
    const [categories, setCategories] = (0, react_1.useState)(['DIRECT_SALES_OPS']);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [err, setErr] = (0, react_1.useState)(null);
    const actions = (0, ShopsActionsContext_1.useShopsActionsSafe)();
    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
            const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, categories }) });
            const j = await res.json();
            if (!res.ok)
                throw new Error(j?.error || 'failed');
            const user = j.user;
            if (shopId) {
                const r2 = await fetch(`/api/shops/${shopId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, roleAtShop }) });
                const j2 = await r2.json();
                if (!r2.ok)
                    throw new Error(j2?.error || 'assign failed');
            }
            // Notify the user and let a parent update the UI in-place if available.
            setEmail('');
            setName('');
            setShopId('');
            setCategories(['DIRECT_SALES_OPS']);
            (0, toast_1.showToast)('Attendant created', 'success');
            // Notify parent via context if available (provider optional).
            actions.onAttendantCreated(user, shopId ? { shopId, roleAtShop } : undefined);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setErr(msg);
        }
        finally {
            setBusy(false);
        }
    }
    return ((0, jsx_runtime_1.jsxs)("form", { onSubmit: submit, className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block", children: "Email" }), (0, jsx_runtime_1.jsx)("input", { value: email, onChange: e => setEmail(e.target.value), className: "border p-1", required: true })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block", children: "Name" }), (0, jsx_runtime_1.jsx)("input", { value: name, onChange: e => setName(e.target.value), className: "border p-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block", children: "Categories" }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-1 border border-slate-600/40 p-2 rounded", children: definitions_1.attendantCategoryOptions.map(opt => {
                            const checked = categories.includes(opt.id);
                            return ((0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: checked, onChange: e => {
                                            const next = e.target.checked
                                                ? Array.from(new Set([...categories, opt.id]))
                                                : categories.filter(c => c !== opt.id);
                                            if (!next.length) {
                                                (0, toast_1.showToast)('Select at least one category', 'error');
                                                return;
                                            }
                                            setCategories(next);
                                        } }), (0, jsx_runtime_1.jsx)("span", { children: opt.label })] }, opt.id));
                        }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block", children: "Assign to shop (optional)" }), (0, jsx_runtime_1.jsxs)("select", { value: shopId, onChange: e => setShopId(e.target.value), className: "border p-1", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "-- none --" }), shops.map(s => (0, jsx_runtime_1.jsx)("option", { value: s.id, children: s.name }, s.id))] }), shopId && ((0, jsx_runtime_1.jsxs)("select", { value: roleAtShop, onChange: e => setRoleAtShop(e.target.value), className: "border p-1 ml-2", children: [(0, jsx_runtime_1.jsx)("option", { children: "ATTENDANT" }), (0, jsx_runtime_1.jsx)("option", { children: "SUPERVISOR" })] }))] }), err && (0, jsx_runtime_1.jsx)("div", { className: "text-red-600", children: err }), (0, jsx_runtime_1.jsx)("button", { type: "submit", disabled: busy, className: "px-3 py-1 bg-green-600 text-white", children: "Create Attendant" })] }));
}
