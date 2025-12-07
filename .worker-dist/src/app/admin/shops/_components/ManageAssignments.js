"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ManageAssignments;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const toast_1 = require("@/lib/ui/toast");
const toast_2 = require("@/lib/ui/toast");
function ManageAssignments({ shopId }) {
    const [rows, setRows] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            try {
                const res = await fetch(`/api/shops/${shopId}/assignments`);
                if (!res.ok)
                    throw new Error('Failed to load');
                const j = await res.json();
                if (mounted)
                    setRows(j || []);
            }
            catch {
                (0, toast_1.showToast)('Failed to load assignments', 'error');
            }
            finally {
                if (mounted)
                    setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [shopId]);
    async function remove(userId) {
        // two-step delete confirmation: first click marks pending
        const ok = await (0, toast_2.confirmDialog)(`Remove assignment for user ${userId}?`);
        if (!ok)
            return;
        try {
            const res = await fetch(`/api/shops/${shopId}/assignments`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
            if (!res.ok)
                throw new Error('Delete failed');
            (0, toast_1.showToast)('Removed assignment', 'success');
            // refresh assignments
            const r2 = await fetch(`/api/shops/${shopId}/assignments`);
            if (r2.ok) {
                const j2 = await r2.json();
                setRows(j2 || []);
            }
        }
        catch {
            (0, toast_1.showToast)('Failed to remove assignment', 'error');
        }
    }
    if (loading)
        return (0, jsx_runtime_1.jsx)("div", { children: "Loading..." });
    if (!rows.length)
        return (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-500", children: "No assignments" });
    return ((0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: rows.map(r => ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center p-2 border rounded", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: r.user.name ?? r.user.email }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-500", children: r.roleAtShop })] }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)("button", { className: "text-red-600 px-2 py-1", onClick: () => remove(r.user.id), children: "Remove" }) })] }, r.id))) }));
}
